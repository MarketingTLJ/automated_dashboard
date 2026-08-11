"""
TLJ Dashboard — extração direta do Bitrix24 (substitui o fluxo de Excel).

    export BITRIX_WEBHOOK_URL='https://SEUPORTAL.bitrix24.com.br/rest/1/TOKEN/'
    export SHEET_INVESTIMENTOS_URL='https://docs.google.com/spreadsheets/d/.../edit#gid=0'
    export SHEET_FONTES_PAGAS_URL='https://docs.google.com/spreadsheets/d/.../edit#gid=0'
    python scripts/extract_bitrix.py

PRINCÍPIO CENTRAL — não reimplementar regra de negócio.
Este script monta DataFrames com EXATAMENTE os mesmos nomes de coluna que os
Excel produziam e então chama `build_month` / `build_month_termino` do
extract.py, sem alterá-los. Toda a lógica validada (fases de perda do SDR,
MOTIVOS_NAO_EFETIVOS, VLOOKUP Empresa->Fonte, Net ROI, CPL por criação)
continua sendo a mesma, num único lugar.

Se você precisar mudar uma REGRA, mexa em extract.py.
Se precisar mudar de ONDE o dado vem, mexa aqui.

MESES CONGELADOS — ver o bloco MESES_ABERTOS abaixo. Meses fechados são gravados
uma vez em meses_congelados.json e nunca mais recalculados, para que o passado
do dashboard não se mexa sozinho quando alguém edita ou exclui um negócio antigo.
Para reprocessar um mês específico depois de uma correção legítima no CRM:

    python scripts/extract_bitrix.py --descongelar=2026-03

Isso recalcula aquele mês UMA vez e o recongela com o valor corrigido.
"""

import io
import json
import os
import re
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))

from bitrix_client import BitrixClient          # noqa: E402
import extract as legado                        # noqa: E402

ROOT      = Path(__file__).parent.parent
OUTPUT    = ROOT / "src" / "data" / "data.js"
MAPA      = Path(__file__).parent / "bitrix_map.json"
CONGELADO = Path(__file__).parent / "meses_congelados.json"

# ── CONGELAMENTO DE MESES FECHADOS ───────────────────────────────────────
# Os Excel congelavam o passado por acidente: eram fotografias. Ler o CRM ao
# vivo não congela nada — um negócio excluído ou movido de funil hoje reescreve
# março. Medido em 2026-08-10: Jul/26 tinha 150 leads SDR na exportação de
# 01/ago e 143 no CRM; os perdidos passaram de 103 para 126.
#
# Um dashboard executivo não pode ter o passado se mexendo sozinho: o número
# que a diretoria viu tem de continuar sendo aquele. Então meses fechados são
# gravados uma vez em meses_congelados.json e nunca mais recalculados.
#
# MESES_ABERTOS = 2 -> mês corrente e o anterior seguem sendo recalculados todo
# dia (negócios de fim de mês só fecham nos primeiros dias do mês seguinte).
# Tudo mais velho que isso é congelado.
MESES_ABERTOS = 2

# ⚠️ FUSO HORÁRIO — ponto de atenção real.
# O portal responde em +03:00 (horário de Moscou). Um negócio criado às 21h de
# 31/jul em Brasília vira 03h de 01/ago no fuso do portal e cairia no mês errado.
# As planilhas eram exportadas no fuso do perfil de quem exportava.
# Este valor é o que a Fase 3 (diff Excel x Bitrix) tem de confirmar — se os
# totais de fim de mês divergirem por 1 ou 2 negócios, é quase certo que é aqui.
TIMEZONE = "America/Sao_Paulo"


# ══ Planilhas do Google (investimento e fontes pagas) ═════════════════════

def _url_csv(url: str) -> str:
    """Converte uma URL de planilha do Google na URL de exportação CSV."""
    m = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", url)
    if not m:
        raise SystemExit(f"URL de planilha não reconhecida: {url}")
    doc_id = m.group(1)
    gid = "0"
    g = re.search(r"[#&?]gid=(\d+)", url)
    if g:
        gid = g.group(1)
    return f"https://docs.google.com/spreadsheets/d/{doc_id}/export?format=csv&gid={gid}"


def _ler_sheet(origem: str, nome: str) -> pd.DataFrame:
    """
    Lê a planilha de `origem`, que pode ser:
      - uma URL do Google Sheets (precisa estar compartilhada com "qualquer
        pessoa com o link"; a leitura é anônima, sem login); ou
      - um caminho local .xlsx/.csv — útil para rodar na sua máquina antes de
        resolver o compartilhamento, e como plano B se o Google sair do ar.
    """
    if not origem.lower().startswith("http"):
        caminho = Path(origem)
        if not caminho.is_absolute():
            caminho = ROOT / origem
        if not caminho.exists():
            raise SystemExit(f"Arquivo de {nome} não encontrado: {caminho}")
        df = (pd.read_csv(caminho) if caminho.suffix.lower() == ".csv"
              else pd.read_excel(caminho))
        print(f"    {nome}: lido de {caminho.name}")
    else:
        csv_url = _url_csv(origem)
        try:
            df = pd.read_csv(csv_url)
        except Exception as e:
            raise SystemExit(
                f"Não consegui ler a planilha de {nome}.\n"
                f"  URL de exportação: {csv_url}\n"
                f"  Erro: {e}\n\n"
                "Causa mais comum (HTTP 401/403): a planilha não está pública.\n"
                "Corrija em Compartilhar > Acesso geral > 'Qualquer pessoa com o\n"
                "link' (Leitor). Compartilhar só com o Grupo TLJ NÃO basta: a\n"
                "leitura é anônima, sem sessão do Google.\n\n"
                "Alternativa: aponte a variável para um arquivo local, ex.\n"
                "  SHEET_INVESTIMENTOS_URL=Reports/INVESTIMENTOS.xlsx"
            ) from None

    if df.empty:
        raise SystemExit(f"A planilha de {nome} voltou vazia — confira o gid na URL.")
    return df


def _para_reais(serie: pd.Series) -> pd.Series:
    """
    'R$ 1.234,56' -> 1234.56. O CSV do Google vem com o texto formatado em pt-BR;
    o .xlsx local já vem numérico — nesse caso passa direto.
    """
    if pd.api.types.is_numeric_dtype(serie):
        return serie
    return pd.to_numeric(
        serie.astype(str)
             .str.replace(r"[R$\s ]", "", regex=True)
             .str.replace(".", "", regex=False)
             .str.replace(",", ".", regex=False)
             .replace({"": None, "-": None, "nan": None}),
        errors="coerce",
    )


def carregar_investimentos(url: str) -> tuple[dict, dict]:
    """
    Retorna ({ym: total}, {ym: {canal: valor}}).
    Espelha load_investments/load_inv_breakdown do extract.py: última linha é o
    total, as demais são canais, e as colunas são rótulos 'mmm/aa'.
    """
    df = _ler_sheet(url, "investimentos")
    col_canal = df.columns[0]

    inv_map, breakdown = {}, {}
    for col in df.columns[1:]:
        ym = legado._ym(str(col))
        if not ym or "?" in ym:
            continue
        valores = _para_reais(df[col])
        total = valores.iloc[-1]
        if pd.notna(total):
            inv_map[ym] = round(float(total), 2)
        canais = {}
        for i in range(len(df) - 1):
            v = valores.iloc[i]
            if pd.notna(v) and v > 0:
                canais[str(df[col_canal].iloc[i])] = round(float(v), 2)
        if canais:
            breakdown[ym] = canais

    if not inv_map:
        raise SystemExit(
            "Nenhum mês reconhecido na planilha de investimentos.\n"
            "Os cabeçalhos precisam seguir o padrão 'mmm/aa' minúsculo (jan/25, fev/25...)."
        )
    return inv_map, breakdown


def carregar_fontes_pagas(url: str) -> set:
    df = _ler_sheet(url, "fontes pagas")
    pagas = df[df.iloc[:, 1].astype(str).str.strip() == "Sim"].iloc[:, 0]
    return set(pagas.astype(str).str.strip())


# ══ Bitrix -> DataFrames no formato das planilhas ════════════════════════

def carregar_mapa() -> dict:
    if not MAPA.exists():
        raise SystemExit(
            f"{MAPA} não existe.\n\n"
            "Rode a Fase 0 primeiro:\n"
            "    python scripts/discover_fields.py\n\n"
            "Ela descobre quais UF_CRM_* correspondem a '#TLJ# SDR',\n"
            "'[SDR] Motivo de perda', 'É renovação?' etc."
        )
    mapa = json.loads(MAPA.read_text(encoding="utf-8"))
    if mapa.get("campos_faltando"):
        raise SystemExit(
            "O mapeamento está incompleto — campos não resolvidos:\n"
            + "".join(f"  - {c}\n" for c in mapa["campos_faltando"])
            + "\nEdite scripts/bitrix_map.json à mão ou rode discover_fields.py de novo."
        )
    for nome, info in mapa.get("funis", {}).items():
        if "canonico" not in info:
            raise SystemExit(
                f"O funil '{nome}' não tem o bloco 'canonico' em bitrix_map.json.\n\n"
                "Esse bloco traduz STAGE_ID -> nome canônico de fase, ex.:\n"
                '    "canonico": { "C107:WON": "Venda - Ganho", "C107:LOSE": "Perdido" }\n\n'
                "É ele que torna o pipeline imune a renomeação de etapa no Bitrix —\n"
                "exatamente o bug que escondeu 2.772 leads perdidos (CLAUDE.md §3.1)."
            )
    return mapa


def _data(serie: pd.Series) -> pd.Series:
    """ISO com fuso -> datetime naive no fuso de referência (ver TIMEZONE)."""
    s = pd.to_datetime(serie, errors="coerce", utc=True)
    return s.dt.tz_convert(TIMEZONE).dt.tz_localize(None)


def montar_df(deals: list, mapa: dict, funil: str, usuarios: dict,
              fontes: dict, empresas: dict, enums: dict | None = None) -> pd.DataFrame:
    """Converte negócios crus do Bitrix num DataFrame com as colunas do Excel."""
    if not deals:
        return pd.DataFrame()

    df = pd.DataFrame(deals)
    campos = mapa["campos"]
    # As listas de valores vêm da API (ao vivo), não do mapa: assim um motivo
    # de perda novo aparece sozinho, sem precisar regerar o bitrix_map.json.
    enums  = enums if enums is not None else mapa.get("enums", {})
    canonico = mapa["funis"][funil]["canonico"]

    def uf(alvo: str) -> pd.Series:
        """Coluna de um campo customizado, já traduzindo listas para texto."""
        fname = campos.get(alvo)
        if not fname or fname not in df.columns:
            return pd.Series([None] * len(df), index=df.index)
        col = df[fname]
        if fname in enums:
            tabela = enums[fname]
            return col.map(lambda v: tabela.get(str(v)) if v not in (None, "", False) else None)
        return col

    out = pd.DataFrame(index=df.index)

    # Fase: STAGE_ID -> nome canônico. Etapa desconhecida vira o próprio ID,
    # para aparecer como anomalia em vez de sumir silenciosamente.
    out["Fase"] = df["STAGE_ID"].map(lambda s: canonico.get(s, s))
    out["Criado"]              = _data(df["DATE_CREATE"])
    out["Data de fechamento"]  = _data(df["CLOSEDATE"])
    out["Responsável"]         = df["ASSIGNED_BY_ID"].astype(str).map(usuarios)
    out["Fonte"]               = df.get("SOURCE_ID", pd.Series(index=df.index)) \
                                   .astype(str).map(fontes).fillna("Não identificado")
    out["Empresa"]             = df.get("COMPANY_ID", pd.Series(index=df.index)) \
                                   .astype(str).map(empresas)

    # 'Renda': campo customizado se existir, senão o valor padrão do negócio.
    if campos.get("Renda") and campos["Renda"] in df.columns:
        out["Renda"] = pd.to_numeric(df[campos["Renda"]], errors="coerce").fillna(0.0)
    else:
        out["Renda"] = pd.to_numeric(df.get("OPPORTUNITY"), errors="coerce").fillna(0.0)

    # '#TLJ# SDR' é do tipo 'employee': devolve ID de usuário, não texto.
    # O extract.py compara esse campo com a coluna 'Responsável' do SDR, que é
    # nome. Sem resolver o ID aqui, o funil SDR->Closer zera silenciosamente.
    out["#TLJ# SDR"] = uf("#TLJ# SDR").map(
        lambda v: usuarios.get(str(v)) if v not in (None, "", 0, "0") else None
    )
    out["[SDR] Motivo de perda"]            = uf("[SDR] Motivo de perda")
    out["É renovação?"]                     = uf("É renovação?")
    out["[LC] Motivo de perda"]             = uf("[LC] Motivo de perda")
    out["[LC] Cliente está usando Bitrix?"] = uf("[LC] Cliente está usando Bitrix?")
    venc = uf("[LC] Data de vencimento")
    out["[LC] Data de vencimento"] = pd.to_datetime(venc, errors="coerce")

    return out


def carregar_bases(mapa: dict):
    """Lê os 4 funis e devolve (sdr, closer, rent, lics) no formato do extract.py."""
    bx = BitrixClient()

    print("Lendo tabelas de apoio...")
    usuarios = bx.users()
    fontes   = bx.sources()
    empresas = bx.companies()
    enums    = bx.userfield_enum()
    print(f"  {len(usuarios)} usuários · {len(fontes)} fontes · "
          f"{len(empresas)} empresas · {len(enums)} campos de lista")

    print("Lendo negócios...")
    bases = {}
    for funil, info in mapa["funis"].items():
        deals = bx.deals(info["category_id"], label=funil)
        bases[funil] = montar_df(deals, mapa, funil, usuarios, fontes, empresas, enums)

    sdr    = bases["sdr"]
    closer = bases["closer"]
    rent   = bases["rent"]
    lics   = bases["licencas"]

    # Colunas derivadas — exatamente como load_dataframes() do extract.py.
    for df in (sdr, closer, rent):
        df["dt"]      = df["Criado"]
        df["dt_fech"] = df["Data de fechamento"]
    sdr["FaseAdj"] = sdr["Fase"].apply(
        lambda x: "Perdido" if x in legado.FASES_PERDIDO_SDR else x
    )
    lics["dt_venc"] = lics["[LC] Data de vencimento"]

    # VLOOKUP Empresa -> Fonte, reusando a implementação do extract.py.
    legado._vlookup_fonte(rent, closer, label="Rent")
    legado._vlookup_fonte(lics, closer, label="LC")

    print(f"  SDR: {len(sdr)} · Closer: {len(closer)} · "
          f"Rent: {len(rent)} · Licenças: {len(lics)}  "
          f"({bx.call_count} chamadas)")
    return sdr, closer, rent, lics


def meses_disponiveis(sdr, closer) -> list:
    """Gera [(ym, label)] de Jan/25 até o mês mais recente com dado."""
    rotulos = {v: k.capitalize() for k, v in legado._MES_PT.items()}
    datas = pd.concat([sdr["dt"], closer["dt"]]).dropna()
    if datas.empty:
        raise SystemExit("Nenhum negócio com data de criação válida.")
    fim = datas.max()
    out = []
    for periodo in pd.period_range("2025-01", f"{fim.year}-{fim.month:02d}", freq="M"):
        ym = f"{periodo.year}-{periodo.month:02d}"
        out.append((ym, f"{rotulos[f'{periodo.month:02d}']}/{str(periodo.year)[2:]}"))
    return out


# ══ Congelamento ═════════════════════════════════════════════════════════

def carregar_congelados() -> dict:
    if not CONGELADO.exists():
        return {"DATA": {}, "DATA_TERMINO": {}, "_congelado_em": {}}
    d = json.loads(CONGELADO.read_text(encoding="utf-8"))
    d.setdefault("DATA", {})
    d.setdefault("DATA_TERMINO", {})
    d.setdefault("_congelado_em", {})
    return d


def limite_aberto(meses: list) -> str:
    """ym a partir do qual os meses seguem abertos (recalculados todo dia)."""
    return meses[max(0, len(meses) - MESES_ABERTOS)][0]


def aplicar_congelamento(frescos: dict, frescos_t: dict, meses: list,
                         congelados: dict, descongelar: set) -> tuple:
    """
    Devolve (DATA, DATA_TERMINO) combinando meses congelados com os recém-lidos,
    e atualiza `congelados` in-place com os meses que fecharam agora.
    """
    corte = limite_aberto(meses)
    agora = pd.Timestamp.now(tz=TIMEZONE).isoformat()
    novos, reusados = [], []

    saida, saida_t = [], []
    for ym, _label in meses:
        # 'fechado' é uma propriedade do calendário. '--descongelar' NÃO reabre o
        # mês: manda recalculá-lo uma vez e recongelar com o valor corrigido —
        # senão o mês passaria a derivar todo dia, que é justo o que se quer evitar.
        fechado = ym < corte
        ja_congelado = ym in congelados["DATA"]

        if fechado and ja_congelado and ym not in descongelar:
            saida.append(congelados["DATA"][ym])
            if ym in congelados["DATA_TERMINO"]:
                saida_t.append(congelados["DATA_TERMINO"][ym])
            reusados.append(ym)
            continue

        if ym in frescos:
            saida.append(frescos[ym])
        if ym in frescos_t:
            saida_t.append(frescos_t[ym])

        # Mês fechado ainda não congelado, ou recém-descongelado -> (re)congela.
        if fechado:
            if ym in frescos:
                congelados["DATA"][ym] = frescos[ym]
            if ym in frescos_t:
                congelados["DATA_TERMINO"][ym] = frescos_t[ym]
            congelados["_congelado_em"][ym] = agora
            novos.append(ym)

    abertos = [ym for ym, _ in meses if ym >= corte]
    print(f"\n  Congelados reusados: {len(reusados)}")
    if novos:
        print(f"  Congelados AGORA:    {', '.join(novos)}")
    print(f"  Abertos (recalculados todo dia): {', '.join(abertos)}")
    if descongelar:
        print(f"  Descongelados por pedido: {', '.join(sorted(descongelar))}")
    return saida, saida_t


# ══ Main ═════════════════════════════════════════════════════════════════

def main():
    print("TLJ Dashboard — extração via Bitrix24")
    print("=" * 60)

    mapa = carregar_mapa()

    url_inv = os.environ.get("SHEET_INVESTIMENTOS_URL", "").strip()
    url_fp  = os.environ.get("SHEET_FONTES_PAGAS_URL", "").strip()
    if not url_inv or not url_fp:
        raise SystemExit(
            "Defina SHEET_INVESTIMENTOS_URL e SHEET_FONTES_PAGAS_URL "
            "(GitHub Secrets em produção)."
        )

    print("\nLendo planilhas do Google...")
    inv_map, inv_breakdown = carregar_investimentos(url_inv)
    fontes_pagas = carregar_fontes_pagas(url_fp)
    print(f"  Investimento em {len(inv_map)} meses · {len(fontes_pagas)} fontes pagas")

    print()
    sdr, closer, rent, lics = carregar_bases(mapa)

    meses = meses_disponiveis(sdr, closer)
    print(f"\nProcessando {len(meses)} meses (Jan/25 -> {meses[-1][1]})...")

    congelados  = carregar_congelados()
    descongelar = {a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--descongelar=")}
    corte = limite_aberto(meses)

    frescos, frescos_t = {}, {}
    for ym, label in meses:
        # Mês já congelado e não pedido para descongelar: não recalcula.
        if ym < corte and ym in congelados["DATA"] and ym not in descongelar:
            continue

        y, m = int(ym[:4]), int(ym[5:])
        tem_criado = (((sdr["dt"].dt.year == y) & (sdr["dt"].dt.month == m)).any()
                      or ((closer["dt"].dt.year == y) & (closer["dt"].dt.month == m)).any())
        if tem_criado:
            linha = legado.build_month(ym, label, sdr, closer, rent, lics,
                                       inv_map, inv_breakdown)
            frescos[ym] = linha
            print(f"  {label}: leads={linha['leads_total']}, ganho={linha['ganho']}, "
                  f"rec_v=R${linha['rec_v']:,.0f}")

        tem_termino = ((closer["dt_fech"].dt.year == y) & (closer["dt_fech"].dt.month == m)).any()
        tem_lc      = ((lics["dt_venc"].dt.year == y) & (lics["dt_venc"].dt.month == m)).any()
        if tem_termino or tem_lc:
            linha_t = legado.build_month_termino(ym, label, sdr, closer, rent, lics,
                                                 inv_map, inv_breakdown)
            if linha_t["leads_total"] > 0 or linha_t["rec_v"] > 0 or linha_t["lc_total"] > 0:
                frescos_t[ym] = linha_t

    mensal, mensal_termino = aplicar_congelamento(
        frescos, frescos_t, meses, congelados, descongelar)

    CONGELADO.write_text(
        json.dumps(congelados, ensure_ascii=False, indent=2), encoding="utf-8")

    if not mensal:
        raise SystemExit("Nenhum mês processado — verifique os funis em bitrix_map.json.")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    conteudo = (
        f"// AUTO-GERADO por scripts/extract_bitrix.py — NÃO EDITAR À MÃO\n"
        f"// Fonte: Bitrix24 REST + Google Sheets (investimentos, fontes pagas)\n"
        f"// Atualizado em: {pd.Timestamp.now(tz=TIMEZONE).strftime('%Y-%m-%d %H:%M')} "
        f"({TIMEZONE})\n"
        f"// DATA:         {mensal[0]['label']} -> {mensal[-1]['label']} "
        f"({len(mensal)} meses, por Criado)\n"
        f"// DATA_TERMINO: {mensal_termino[0]['label'] if mensal_termino else '?'} -> "
        f"{mensal_termino[-1]['label'] if mensal_termino else '?'} "
        f"({len(mensal_termino)} meses, por dt_fech)\n\n"
        f"export const DATA = {json.dumps(mensal, ensure_ascii=False, indent=2)};\n\n"
        f"export const DATA_TERMINO = {json.dumps(mensal_termino, ensure_ascii=False, indent=2)};\n\n"
        f"export const FONTES_PAGAS = {json.dumps(sorted(fontes_pagas), ensure_ascii=False)};\n\n"
        f"export const MOTIVOS_NAO_EFETIVOS = "
        f"{json.dumps(sorted(legado.MOTIVOS_NAO_EFETIVOS), ensure_ascii=False)};\n\n"
        f"export const ATUALIZADO_EM = "
        f"{json.dumps(pd.Timestamp.now(tz=TIMEZONE).isoformat())};\n"
    )
    OUTPUT.write_text(conteudo, encoding="utf-8")
    print(f"\nGravado: {len(mensal)} meses (DATA) + {len(mensal_termino)} (DATA_TERMINO)")
    print(f"  -> {OUTPUT}")


if __name__ == "__main__":
    main()
