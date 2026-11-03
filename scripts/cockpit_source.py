"""
Cockpit AI — dados da aba "Cockpit AI" (CLAUDE.md §20).

Duas fontes, cruzadas negócio a negócio (PROCV):
  1. Planilha exportada do Cockpit CRM (pipeline Vendas) — Reports/negocios-vendas-AAAA-MM-DD.xlsx
     É a BASE COMPLETA: etapa, responsável, valor (mensalidade) e origem de cada negócio.
     Exportada à mão pelo usuário (a mais recente da pasta é usada).
  2. Bitrix24, pipeline "Marketing" (65): todo cadastro da conta gratuita
     (cockpitai.net.br/comecar) cai lá com `Informações da fonte` = "Conta gratuita do CRM (…)".
     Traz a data REAL do cadastro e as UTMs (campanha, público, anúncio, posicionamento).

Regras (decisões do usuário em 2026-11-03):
  - Data do lead = data do Bitrix quando casado. O Cockpit importou em 22/10 17:33 os
    cadastros de 20–21/10, então a data do Cockpit é errada para eles.
  - Cadastros no Bitrix criados DEPOIS da exportação entram como "Ainda não na planilha".
    Os anteriores sem par no Cockpit ficam fora (a planilha é a base completa) — só no log.
  - Contas de teste ficam fora (ver `_motivo_teste`). A lista sai no log a cada execução.
  - Valor do negócio = MENSALIDADE (MRR), não valor total de contrato.
  - Sem "leads efetivos" nesta aba.
Somente leitura no Bitrix (bitrix_source.call recusa qualquer escrita).
"""

import json
import re
import unicodedata
from pathlib import Path

import pandas as pd

ROOT    = Path(__file__).parent.parent
REPORTS = ROOT / "Reports"
TZ      = 'America/Sao_Paulo'

PADRAO_PLANILHA  = 'negocios-vendas-*.xlsx'
CAT_MARKETING    = 65
PREFIXO_FONTE    = 'Conta gratuita do CRM'      # início de SOURCE_DESCRIPTION no Bitrix
ORIGEM_CONTA     = 'Conta gratuita do CRM'      # coluna Origem na planilha do Cockpit
ETAPA_GANHO      = {'Fechado'}
ETAPA_PERDIDO    = {'Perdido'}
ETAPA_NOVO       = 'Ainda não na planilha'       # cadastro no Bitrix depois da exportação
# Ordem do Kanban do Cockpit (pipeline Vendas). Etapa nova entra antes de Fechado/Perdido
# e gera AVISO no log — conferir se é etapa de andamento, ganho ou perda.
ETAPAS_ORDEM = ['Não respondido BOT', 'Respondido BOT', 'Em tratativa', 'Conexão feita',
                'Sem resposta', 'DEMO Usando', 'Em proposta', 'Aguardando pagamento',
                'Conta online', 'Fechado', 'Perdido']

COLUNAS = {   # coluna da planilha → nome interno
    'Título': 'titulo', 'Cliente': 'cliente', 'Etapa': 'etapa', 'Valor': 'valor',
    'Responsável': 'resp', 'Origem': 'origem', 'Criado em': 'criado',
    'Última movimentação': 'ultmov',
}

# Nome completo de pessoas do time como aparece no cadastro (o bitrix_users.json usa forma
# curta, ex.: 'Samile Braz'). Conta criada com o nome EXATO de alguém do time = teste.
# Só nome exato: 'Carlos Maxwell Silva' é cliente real, apesar de 'Carlos Silva' ser do time.
EQUIPE_EXTRA = ['Samile Alves Braz', 'Cibeli Emanuela dos Santos', 'Halana Oliveira',
                'Halana Oliveira de Souza', 'Matheus Bueno Martins']

# Cadastros REAIS que a regra de teste pegaria (ID do negócio no Bitrix, pipeline Marketing).
# Confirmados pelo usuário em 2026-11-03.
NAO_TESTE_BITRIX_IDS = {
    '155257',   # "Pessoa física" — cliente real que se chama Michael Silva (homônimo do time)
}

SEL_BITRIX = ['ID', 'TITLE', 'STAGE_ID', 'DATE_CREATE', 'SOURCE_DESCRIPTION', 'CONTACT_ID',
              'UTM_SOURCE', 'UTM_MEDIUM', 'UTM_CAMPAIGN', 'UTM_CONTENT', 'UTM_TERM']

# utm_source → plataforma (nomes de vendedor = link pessoal enviado pelo time)
PLATAFORMA = {'fb': 'Facebook', 'ig': 'Instagram', 'th': 'Threads', 'igcockpit': 'Instagram',
              'an': 'Audience Network', 'msg': 'Messenger'}


class CockpitError(RuntimeError):
    pass


def _norm(s) -> str:
    s = unicodedata.normalize('NFKD', str(s if s is not None and s == s else ''))
    s = s.encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9@. ]', ' ', s)).strip()


def _partes(titulo) -> list:
    """'Conta gratuita do CRM · Empresa · Atende Mira IA · Estética' → ['Empresa', 'Atende Mira IA', 'Estética']"""
    p = [x.strip() for x in str(titulo or '').split('·')]
    return p[1:] if len(p) > 1 and _norm(p[0]).startswith('conta gratuita') else []


def _chave_titulo(titulo) -> str:
    p = _partes(titulo)
    return _norm(p[0]) if p else _norm(titulo)


def _segmento(titulo):
    """Segmento escolhido no cadastro; 'Atende Mira IA' = marcou interesse na IA Mira."""
    p = _partes(titulo)
    resto = [x for x in p[1:] if _norm(x) != 'atende mira ia']
    return (resto[0] if resto else None), any(_norm(x) == 'atende mira ia' for x in p)


# ── Testes ────────────────────────────────────────────────────────────────────
def _equipe() -> list:
    users = ROOT / 'scripts' / 'bitrix_users.json'
    nomes = list(json.loads(users.read_text(encoding='utf-8')).values()) if users.exists() else []
    return sorted({_norm(n) for n in nomes + EQUIPE_EXTRA if n and n != 'Automação'})


def _e_da_equipe(nome, equipe) -> bool:
    """Nome completo (2+ palavras) igual ao de alguém do time."""
    n = _norm(nome)
    return len(n.split()) >= 2 and n in equipe


def _motivo_teste(textos, nomes, equipe, bitrix_id=None):
    if bitrix_id is not None and str(bitrix_id) in NAO_TESTE_BITRIX_IDS:
        return None
    alvo = ' '.join(_norm(x) for x in textos + nomes)
    if re.search(r'\btest(e|es)?\b', alvo):
        return 'contém "teste"'
    if 'apagar' in alvo.split():
        return 'contém "apagar"'
    if any('<script' in str(x).lower() or '<sc ript' in str(x).lower() for x in textos):
        return 'cadastro inválido (código no nome)'
    for n in nomes:
        if _e_da_equipe(n, equipe):
            return f'conta do time ({n})'
    return None


# ── Leitura ───────────────────────────────────────────────────────────────────
def planilha_mais_recente() -> Path | None:
    found = sorted(REPORTS.glob(PADRAO_PLANILHA), key=lambda p: p.name)
    return found[-1] if found else None


def load_planilha(path: Path) -> pd.DataFrame:
    df = pd.read_excel(path)
    faltando = [c for c in COLUNAS if c not in df.columns]
    if faltando:
        raise CockpitError(f"Planilha do Cockpit sem as colunas {faltando} — o formato da exportação mudou?")
    df = df.rename(columns=COLUNAS)[list(COLUNAS.values())]
    df['criado'] = pd.to_datetime(df['criado'], errors='coerce')
    df['ultmov'] = pd.to_datetime(df['ultmov'], errors='coerce')
    df['valor']  = pd.to_numeric(df['valor'], errors='coerce').fillna(0.0)
    return df


def load_bitrix() -> pd.DataFrame:
    """Cadastros da conta gratuita no pipeline Marketing (qualquer etapa) + nome do contato."""
    from bitrix_source import call, _result, BitrixError
    rows, last = [], 0
    while True:
        r = call('crm.deal.list', {'filter': {'CATEGORY_ID': CAT_MARKETING, '>ID': last},
                                   'order': {'ID': 'ASC'}, 'select': SEL_BITRIX, 'start': -1})
        if 'result' not in r:
            raise BitrixError(f"crm.deal.list (Marketing): {r.get('error')} — {r.get('error_description')}")
        rows += r['result']
        if len(r['result']) < 50:
            break
        last = int(r['result'][-1]['ID'])
    rows = [x for x in rows if (x.get('SOURCE_DESCRIPTION') or '').startswith(PREFIXO_FONTE)]
    ids = sorted({x['CONTACT_ID'] for x in rows if x.get('CONTACT_ID')})
    contatos = {}
    for i in range(0, len(ids), 50):
        for c in _result('crm.contact.list', {'filter': {'@ID': ids[i:i + 50]},
                                               'select': ['ID', 'NAME', 'LAST_NAME']}):
            contatos[c['ID']] = ' '.join(filter(None, [c.get('NAME'), c.get('LAST_NAME')])).strip()
    df = pd.DataFrame(rows, columns=SEL_BITRIX)
    df['nome'] = df['CONTACT_ID'].map(contatos).fillna('')
    df['dt']   = pd.to_datetime(df['DATE_CREATE'], utc=True).dt.tz_convert(TZ).dt.tz_localize(None)
    return df


# ── Cruzamento (PROCV) ────────────────────────────────────────────────────────
def _casar(ck: pd.DataFrame, bx: pd.DataFrame) -> pd.Series:
    """
    Para cada negócio do Cockpit, o ID do cadastro no Bitrix (ou None). Em 3 passos, sempre
    1-para-1: título+nome → título → nome. Nos passos 2 e 3 a data tem de bater (±3 dias),
    porque títulos genéricos ('Outro', 'TLJ') e nomes repetidos existem. O time às vezes
    renomeia o card no Cockpit para o nome do cliente — por isso o passo por nome.
    """
    ck_t = ck['titulo'].map(_chave_titulo); ck_n = ck['cliente'].map(_norm)
    bx_t = bx['TITLE'].map(_chave_titulo);  bx_n = bx['nome'].map(_norm)
    par, livres = {i: None for i in ck.index}, set(bx.index)
    for chaves, janela in ((('t', 'n'), None), (('t',), 3), (('n',), 3)):
        for i in [k for k in ck.index if par[k] is None]:
            vals = {'t': ck_t[i], 'n': ck_n[i]}
            if not all(vals[k] for k in chaves):
                continue
            cand = [j for j in livres
                    if all((bx_t if k == 't' else bx_n)[j] == vals[k] for k in chaves)]
            if janela is not None and pd.notna(ck.at[i, 'criado']):
                cand = [j for j in cand if abs((ck.at[i, 'criado'] - bx.at[j, 'dt']).days) <= janela]
            if len(cand) == 1:
                par[i] = cand[0]
                livres.discard(cand[0])
    return pd.Series(par, dtype=object)


def _etapas_ordenadas(presentes, log):
    novas = [e for e in presentes if e not in ETAPAS_ORDEM and e != ETAPA_NOVO]
    for e in novas:
        log(f"  AVISO Cockpit: etapa nova '{e}' — tratada como 'em andamento'. Conferir se é ganho/perda.")
    base = [e for e in ETAPAS_ORDEM if e in presentes]
    fim = [e for e in base if e in ETAPA_GANHO | ETAPA_PERDIDO]
    meio = [e for e in base if e not in fim]
    return ([ETAPA_NOVO] if ETAPA_NOVO in presentes else []) + meio + novas + fim, novas


def build(inv_cockpit: dict, desde: str, log=print, com_bitrix=True) -> dict | None:
    """
    Monta o objeto COCKPIT do data.js. inv_cockpit = {ym: valor} da linha do Cockpit em
    INVESTIMENTOS.xlsx. Sem planilha → None (a aba explica). Erro de formato → CockpitError.
    """
    path = planilha_mais_recente()
    if path is None:
        log(f"  AVISO Cockpit: nenhuma planilha '{PADRAO_PLANILHA}' em Reports/ — aba Cockpit sem dados")
        return None
    ck = load_planilha(path)
    posicao = max(ck['ultmov'].max(), ck['criado'].max())
    log(f"  Cockpit: {path.name} · {len(ck)} negócios · posição em {posicao:%d/%m/%Y %H:%M}")

    bx = load_bitrix() if com_bitrix else pd.DataFrame(columns=SEL_BITRIX + ['nome', 'dt'])
    par = _casar(ck, bx) if len(bx) else pd.Series({i: None for i in ck.index}, dtype=object)
    casados = {j for j in par if j is not None and pd.notna(j)}
    so_bx = bx.loc[[j for j in bx.index if j not in casados]]
    novos = so_bx[so_bx['dt'] > posicao]
    sem_par = so_bx[so_bx['dt'] <= posicao]
    log(f"  Cockpit × Bitrix: {len(bx)} cadastros no Bitrix · {len(casados)} casados · "
        f"{len(novos)} criados depois da planilha · {len(sem_par)} sem par no Cockpit (fora, inclui testes)")

    equipe = _equipe() + [_norm(r) for r in ck['resp'].dropna().unique()]
    leads, testes = [], []

    def utm(j):
        if j is None:
            return None
        b = bx.loc[j]
        s = (b['UTM_SOURCE'] or '').strip()
        out = {
            'plat': PLATAFORMA.get(s.lower(), 'Link de vendedor' if s else None),
            'pos':  (b['UTM_MEDIUM'] or '').replace('_', ' ').strip() or None,
            'camp': (b['UTM_CAMPAIGN'] or '').strip() or None,
            'pub':  (b['UTM_CONTENT'] or '').strip() or None,
            'anun': (b['UTM_TERM'] or '').strip() or None,
        }
        return {k: v for k, v in out.items() if v}

    for i, r in ck.iterrows():
        j = par[i] if pd.notna(par[i]) else None
        nomes = [r['cliente']] + ([bx.at[j, 'nome']] if j is not None else [])
        textos = [r['titulo']] + ([bx.at[j, 'TITLE']] if j is not None else [])
        motivo = _motivo_teste(textos, nomes, equipe, bx.at[j, 'ID'] if j is not None else None)
        if motivo:
            testes.append((str(r['titulo'])[:60], motivo))
            continue
        dt = bx.at[j, 'dt'] if j is not None else r['criado']
        seg, mira = _segmento(r['titulo'] if _partes(r['titulo']) else (bx.at[j, 'TITLE'] if j is not None else ''))
        conta = j is not None or r['origem'] == ORIGEM_CONTA
        leads.append({
            'd': dt.strftime('%Y-%m-%d'), 'e': r['etapa'],
            'o': r['origem'] if pd.notna(r['origem']) else 'Não informada',
            'r': r['resp'] if pd.notna(r['resp']) else 'Sem responsável',
            'v': round(float(r['valor']), 2), 'c': conta,
            **({'s': seg} if seg else {}), **({'mira': True} if mira else {}),
            **({'u': utm(j)} if j is not None and utm(j) else {}),
        })

    for j, b in novos.iterrows():
        motivo = _motivo_teste([b['TITLE']], [b['nome']], equipe, b['ID'])
        if motivo:
            testes.append((str(b['TITLE'])[:60], motivo))
            continue
        seg, mira = _segmento(b['TITLE'])
        leads.append({'d': b['dt'].strftime('%Y-%m-%d'), 'e': ETAPA_NOVO, 'o': ORIGEM_CONTA,
                      'r': 'Ainda não distribuído', 'v': 0.0, 'c': True,
                      **({'s': seg} if seg else {}), **({'mira': True} if mira else {}),
                      **({'u': utm(j)} if utm(j) else {})})

    for t, m in testes:
        log(f"    teste excluído: {t!r} — {m}")
    n_sem_par = 0
    for _, b in sem_par.iterrows():
        if not _motivo_teste([b['TITLE']], [b['nome']], equipe, b['ID']):
            n_sem_par += 1
            log(f"    Bitrix sem par no Cockpit (fora): #{b['ID']} {str(b['TITLE'])[:60]!r}")

    leads.sort(key=lambda x: x['d'])
    etapas, novas = _etapas_ordenadas({l['e'] for l in leads}, log)
    log(f"  Cockpit: {len(leads)} leads na aba · {len(testes)} testes excluídos · "
        f"{sum(l['e'] in ETAPA_GANHO for l in leads)} fechados · {sum(l['e'] in ETAPA_PERDIDO for l in leads)} perdidos")
    return {
        'arquivo':    path.name,
        'posicao_em': posicao.strftime('%Y-%m-%dT%H:%M'),
        'desde':      desde,
        'inv':        {k: v for k, v in sorted(inv_cockpit.items()) if k >= desde and v > 0},
        'etapas':     etapas,
        'etapa_ganho':   sorted(ETAPA_GANHO),
        'etapa_perdido': sorted(ETAPA_PERDIDO),
        'etapa_novo':    ETAPA_NOVO,
        'etapas_novas':  novas,
        'resumo': {'planilha': len(ck), 'bitrix': len(bx), 'casados': len(casados),
                   'novos': len(novos), 'sem_par': n_sem_par, 'testes': len(testes)},
        'leads': leads,
    }
