"""
Bitrix24 → DataFrames no MESMO formato das planilhas exportadas (ver CLAUDE.md §15).

Lê os 4 pipelines do dashboard via Inbound Webhook REST e devolve DataFrames com os
mesmos nomes de coluna que o extract.py já usa — toda a regra de negócio continua no
extract.py; este módulo só substitui o "ler Excel".

SOMENTE LEITURA: `call()` recusa qualquer método que não seja *.list / *.get / *.fields.
A URL do webhook vem de `.env.local` (BITRIX_WEBHOOK_URL) — nunca versionar.
"""

import json
import time
import urllib.error
import urllib.request
from pathlib import Path

import pandas as pd

ROOT       = Path(__file__).parent.parent
ENV_FILE   = ROOT / ".env.local"
USERS_FILE = Path(__file__).parent / "bitrix_users.json"
TZ         = 'America/Sao_Paulo'

# Pipelines do dashboard (crm.category.list, entityTypeId=2). Outros pipelines
# (Inner WhatsApp 113, Outbound PAP 133, Low-Ticket 137...) ficam FORA por decisão do usuário.
CAT_SDR, CAT_CLOSER, CAT_RENT, CAT_LC = 0, 107, 103, 129
# Eventos & Inscritos — baixado inteiro; o extract.py só usa as fontes de EVENTOS (CLAUDE.md §16)
CAT_EVENTOS = 127

# A planilha "BASE SDR - MODIFICADO 2025 a ..." = negócios SDR modificados desde 2025.
SDR_MODIFIED_SINCE = '2025-01-01T00:00:00-03:00'

# Campos personalizados (crm.deal.fields) — validados em 2026-09-30
UF_MOTIVO_SDR = 'UF_CRM_63DAB89F51656'   # [SDR] Motivo de perda
UF_TLJ_SDR    = 'UF_CRM_1731100890'      # #TLJ# SDR (employee)
UF_RENOVACAO  = 'UF_CRM_1736878725444'   # É renovação?
UF_LC_VENC    = 'UF_CRM_43_1709127323'   # [LC] Data de vencimento (date)
UF_LC_MOTIVO  = 'UF_CRM_66E3304029CF4'   # [LC] Motivo de perda
UF_LC_BITRIX  = 'UF_CRM_1777929842107'   # [LC] Cliente está usando Bitrix? (múltiplo)

SELECT = ['ID', 'TITLE', 'STAGE_ID', 'DATE_CREATE', 'CLOSEDATE', 'MOVED_TIME', 'OPPORTUNITY',
          'SOURCE_ID', 'ASSIGNED_BY_ID', 'COMPANY_ID',
          UF_MOTIVO_SDR, UF_TLJ_SDR, UF_RENOVACAO, UF_LC_VENC, UF_LC_MOTIVO, UF_LC_BITRIX]

_READ_ONLY_SUFFIXES = ('.list', '.get', '.fields')


class BitrixError(RuntimeError):
    pass


def _webhook_url() -> str:
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding='utf-8').splitlines():
            if line.startswith('BITRIX_WEBHOOK_URL='):
                url = line.split('=', 1)[1].strip()
                return url if url.endswith('/') else url + '/'
    raise BitrixError("BITRIX_WEBHOOK_URL não encontrada em .env.local (ver CLAUDE.md §15.1)")


def call(method: str, params: dict | None = None, retries: int = 4):
    """POST read-only ao webhook. Repete em erro de rede / limite de requisições."""
    if not method.endswith(_READ_ONLY_SUFFIXES):
        raise BitrixError(f"Método bloqueado (somente leitura): {method}")
    url  = _webhook_url() + method + '.json'
    body = json.dumps(params or {}).encode()
    for attempt in range(retries + 1):
        req = urllib.request.Request(url, data=body, headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            payload = e.read().decode('utf-8', 'replace')
            if e.code in (429, 503) or 'QUERY_LIMIT_EXCEEDED' in payload:
                if attempt < retries:
                    time.sleep(2 * (attempt + 1))
                    continue
            try:
                err = json.loads(payload)
            except ValueError:
                err = {'error': e.code, 'error_description': payload[:200]}
            return {'error': err.get('error'), 'error_description': err.get('error_description')}
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt < retries:
                time.sleep(3 * (attempt + 1))
                continue
            raise BitrixError(f"Falha de rede ao chamar {method}: {e}") from e


def _result(method, params=None):
    r = call(method, params)
    if 'result' not in r:
        raise BitrixError(f"{method}: {r.get('error')} — {r.get('error_description')}")
    return r['result']


def fetch_deals(filter_: dict) -> list[dict]:
    """Todos os negócios do filtro, paginando por ID (rápido: start=-1, sem contagem)."""
    rows, last = [], 0
    while True:
        r = call('crm.deal.list', {'filter': {**filter_, '>ID': last}, 'order': {'ID': 'ASC'},
                                   'select': SELECT, 'start': -1})
        if 'result' not in r:
            raise BitrixError(f"crm.deal.list: {r.get('error')} — {r.get('error_description')}")
        rows += r['result']
        if len(r['result']) < 50:
            return rows
        last = int(r['result'][-1]['ID'])


def fetch_stages(category_id: int) -> list[dict]:
    """[{STATUS_ID, NAME, SEMANTICS}] — SEMANTICS: process / success / failure / apology."""
    ent = 'DEAL_STAGE' if category_id == 0 else f'DEAL_STAGE_{category_id}'
    return [{'STATUS_ID': s['STATUS_ID'], 'NAME': s['NAME'],
             'SEMANTICS': (s.get('EXTRA') or {}).get('SEMANTICS') or 'process'}
            for s in _result('crm.status.list', {'filter': {'ENTITY_ID': ent}})]


def fetch_companies(ids) -> dict:
    ids, out = sorted({str(i) for i in ids if i not in (None, '', '0', 0)}), {}
    for i in range(0, len(ids), 50):
        for c in _result('crm.company.list', {'filter': {'ID': ids[i:i + 50]}, 'select': ['ID', 'TITLE']}):
            out[str(c['ID'])] = c['TITLE']
    return out


def resolve_users(ids) -> tuple[dict, list]:
    """
    ID → nome. Tenta a API (precisa do escopo `user_brief` no webhook); se não houver,
    usa scripts/bitrix_users.json. Nomes obtidos pela API são gravados no arquivo.
    Retorna (mapa, ids_sem_nome).
    """
    ids = sorted({str(i) for i in ids if i not in (None, '', '0', 0)})
    known = json.loads(USERS_FILE.read_text(encoding='utf-8')) if USERS_FILE.exists() else {}
    missing = [i for i in ids if i not in known]
    if missing:
        r = call('user.get', {'filter': {'ID': missing}})
        if 'result' in r:  # sem o escopo `user_brief` vem insufficient_scope → segue com o arquivo
            for u in r['result']:
                nome = f"{u.get('NAME', '')} {u.get('LAST_NAME', '')}".strip()
                if nome:
                    known[str(u['ID'])] = nome
            USERS_FILE.write_text(json.dumps(dict(sorted(known.items(), key=lambda kv: int(kv[0]))),
                                             ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    return known, [i for i in ids if i not in known]


def _enum(fields, code):
    return {str(i['ID']): i['VALUE'] for i in fields.get(code, {}).get('items', [])}


def _dtime(s):
    """Data+hora: a API devolve no fuso do servidor (+03:00) → converter para São Paulo."""
    return pd.to_datetime(s, errors='coerce', utc=True).dt.tz_convert(TZ).dt.tz_localize(None)


def _ddate(s):
    """Campos só-data (CLOSEDATE, vencimento): usar a data de calendário gravada, sem fuso."""
    return pd.to_datetime(s.astype('string').str[:10], errors='coerce')


def _ws(s):
    return s.astype('string').str.replace(r'\s+', ' ', regex=True).str.strip()


def _blank_to_na(s):
    return s.where(s.notna() & (s.astype('string').str.strip() != ''), None)


def _to_df(rows, ctx) -> pd.DataFrame:
    df = pd.DataFrame(rows, columns=SELECT)
    users, bitrix_uso = ctx['users'], ctx['enums'][UF_LC_BITRIX]
    src = _blank_to_na(df['SOURCE_ID'])
    out = pd.DataFrame({
        'ID':                       df['ID'].astype(int),
        'Nome do negócio':          _ws(df['TITLE']),
        'Fase':                     df['STAGE_ID'].map(ctx['stages']),
        # process / success / failure / apology — estável mesmo se a fase for renomeada
        'FaseSem':                  df['STAGE_ID'].map(ctx['semantics']),
        'Criado':                   _dtime(df['DATE_CREATE']),
        'Data de fechamento':       _ddate(df['CLOSEDATE']),
        'Data da mudança de etapa': _dtime(df['MOVED_TIME']),
        'Renda':                    pd.to_numeric(df['OPPORTUNITY'], errors='coerce').fillna(0.0),
        # Fonte excluída do Bitrix → a exportação mostra o código cru; replicamos
        'Fonte':                    src.map(ctx['sources']).fillna(src),
        'Responsável':              _blank_to_na(df['ASSIGNED_BY_ID']).map(
                                        lambda i: users.get(str(i), f'Usuário {i}') if i else None),
        '#TLJ# SDR':                _blank_to_na(df[UF_TLJ_SDR]).map(
                                        lambda i: users.get(str(i), f'Usuário {i}') if i else None),
        'Empresa':                  _ws(df['COMPANY_ID'].map(ctx['companies'])),
        '[SDR] Motivo de perda':    df[UF_MOTIVO_SDR].astype('string').map(ctx['enums'][UF_MOTIVO_SDR]),
        'É renovação?':             df[UF_RENOVACAO].astype('string').map(ctx['enums'][UF_RENOVACAO]),
        '[LC] Data de vencimento':  _ddate(df[UF_LC_VENC]),
        '[LC] Motivo de perda':     df[UF_LC_MOTIVO].astype('string').map(ctx['enums'][UF_LC_MOTIVO]),
        '[LC] Cliente está usando Bitrix?': df[UF_LC_BITRIX].map(
            lambda v: ', '.join(bitrix_uso.get(str(i), str(i)) for i in v) if isinstance(v, list) and v else None),
    })
    out['Empresa'] = out['Empresa'].where(out['Empresa'] != '', None)
    # Mesma ordem da exportação do Bitrix (mais recente primeiro)
    return out.sort_values('ID', ascending=False).reset_index(drop=True)


def load_raw_frames(log=print) -> dict:
    """
    Baixa tudo do Bitrix e devolve:
      {'sdr','closer','rent','lics','eventos': DataFrame, 'stages': {cat: [...]},
       'enums': {...}, 'sources': {nomes}, 'users_missing': [...], 'counts': {...}}
    """
    t0 = time.time()
    fields = _result('crm.deal.fields')
    for code in (UF_MOTIVO_SDR, UF_TLJ_SDR, UF_RENOVACAO, UF_LC_VENC, UF_LC_MOTIVO, UF_LC_BITRIX):
        if code not in fields:
            raise BitrixError(f"Campo {code} não existe mais no Bitrix — revalidar mapeamento (CLAUDE.md §15.3)")
    enums = {c: _enum(fields, c) for c in (UF_MOTIVO_SDR, UF_RENOVACAO, UF_LC_MOTIVO, UF_LC_BITRIX)}

    cats = (CAT_SDR, CAT_CLOSER, CAT_RENT, CAT_LC, CAT_EVENTOS)
    stages_by_cat = {cat: fetch_stages(cat) for cat in cats}
    stages    = {s['STATUS_ID']: s['NAME'] for lst in stages_by_cat.values() for s in lst}
    semantics = {s['STATUS_ID']: s['SEMANTICS'] for lst in stages_by_cat.values() for s in lst}
    sources = {s['STATUS_ID']: s['NAME'] for s in _result('crm.status.list', {'filter': {'ENTITY_ID': 'SOURCE'}})}

    log("  Baixando negócios do Bitrix...")
    raw = {
        'sdr':     fetch_deals({'CATEGORY_ID': CAT_SDR, '>=DATE_MODIFY': SDR_MODIFIED_SINCE}),
        'closer':  fetch_deals({'CATEGORY_ID': CAT_CLOSER}),
        'rent':    fetch_deals({'CATEGORY_ID': CAT_RENT}),
        'lics':    fetch_deals({'CATEGORY_ID': CAT_LC}),
        'eventos': fetch_deals({'CATEGORY_ID': CAT_EVENTOS}),
    }
    companies = fetch_companies(r.get('COMPANY_ID') for rows in raw.values() for r in rows)
    # Eventos não aparecem em tabelas por pessoa — não exigem nome em bitrix_users.json
    users, users_missing = resolve_users(
        r.get(k) for name, rows in raw.items() if name != 'eventos'
        for r in rows for k in ('ASSIGNED_BY_ID', UF_TLJ_SDR))

    ctx = {'stages': stages, 'semantics': semantics, 'sources': sources,
           'companies': companies, 'users': users, 'enums': enums}
    frames = {k: _to_df(v, ctx) for k, v in raw.items()}
    counts = {k: len(v) for k, v in frames.items()}
    log(f"  Bitrix: {counts} · {len(companies)} empresas · {time.time() - t0:.0f}s")
    return {**frames, 'stages': stages_by_cat, 'enums': enums, 'sources': set(sources.values()),
            'users_missing': users_missing, 'counts': counts}
