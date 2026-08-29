"""
FASE 0 — Descoberta do mapeamento Bitrix24 -> colunas das planilhas.

Rode UMA VEZ (e novamente sempre que alguém criar/renomear campo ou etapa):

    export BITRIX_WEBHOOK_URL='https://SEUPORTAL.bitrix24.com.br/rest/1/TOKEN/'
    python scripts/discover_fields.py

Gera `scripts/bitrix_map.json` e imprime um relatório para conferência humana.
NÃO confie no auto-match cegamente: confira o relatório antes de seguir para a Fase 1.

Por que isso existe: o dashboard depende de campos customizados ('#TLJ# SDR',
'[SDR] Motivo de perda', 'É renovação?', 'Renda'...) que na API aparecem como
UF_CRM_1234567890 — nomes opacos que só o portal sabe traduzir.
"""

import json
import re
import unicodedata
from pathlib import Path

from bitrix_client import BitrixClient

OUT = Path(__file__).parent / "bitrix_map.json"

# Funis que o dashboard consome. Confirmados via /api/funnels em 2026-08-10.
CATEGORIES = {
    "sdr":      0,     # SDR
    "closer":   107,   # Closer Comercial
    "rent":     103,   # Rentabilização
    "licencas": 129,   # Licenças
}

# Funis que existem no portal e PODEM pertencer ao escopo — decisão humana.
CATEGORIES_AMBIGUAS = {
    135: "SDR - Mineração        (a BASE SDR do Excel inclui este funil?)",
    139: "Licenças - Novo        (substituiu o funil 129?)",
    113: "Rentabilização Inner   (entra na base de Rentabilização?)",
}

# Colunas das planilhas que precisam sair de campos customizados.
ALVOS = {
    "#TLJ# SDR":                        ["tlj sdr", "sdr"],
    "[SDR] Motivo de perda":            ["sdr motivo de perda", "motivo de perda"],
    "É renovação?":                     ["e renovacao", "renovacao"],
    "Renda":                            ["renda"],
    "[LC] Data de vencimento":          ["lc data de vencimento", "data de vencimento"],
    "[LC] Motivo de perda":             ["lc motivo de perda"],
    "[LC] Cliente está usando Bitrix?": ["lc cliente esta usando bitrix", "usando bitrix"],
}


def norm(s: str) -> str:
    """Minúsculas, sem acento e sem pontuação — para comparar rótulos."""
    s = unicodedata.normalize("NFKD", str(s or ""))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9 ]+", " ", s.lower()).strip()


def rotulo(meta: dict) -> str:
    for k in ("formLabel", "listLabel", "filterLabel", "title"):
        if meta.get(k):
            return str(meta[k])
    return ""


def main():
    bx = BitrixClient()
    print("FASE 0 — Descoberta de campos do Bitrix24")
    print("=" * 64)

    # ── 1. Campos customizados ────────────────────────────────────────────
    print("\nLendo crm.deal.fields...")
    fields = bx.deal_fields()
    custom = {k: v for k, v in fields.items() if k.startswith("UF_CRM")}
    print(f"  {len(fields)} campos no total, {len(custom)} customizados")

    achados, ambiguos, faltando = {}, {}, []
    for alvo, pistas in ALVOS.items():
        candidatos = []
        for fname, meta in custom.items():
            lbl = norm(rotulo(meta))
            if not lbl:
                continue
            if lbl == norm(alvo):
                candidatos.insert(0, (fname, rotulo(meta), meta.get("type"), "exato"))
            elif any(p in lbl for p in pistas):
                candidatos.append((fname, rotulo(meta), meta.get("type"), "parcial"))
        if not candidatos:
            faltando.append(alvo)
        elif len(candidatos) == 1 or candidatos[0][3] == "exato":
            achados[alvo] = candidatos[0][0]
            if len(candidatos) > 1:
                ambiguos[alvo] = candidatos
        else:
            ambiguos[alvo] = candidatos

    print("\n--- MAPEAMENTO AUTOMÁTICO ---")
    for alvo, fname in achados.items():
        print(f"  OK  {alvo:<36} -> {fname}  ({rotulo(custom[fname])})")
    for alvo in faltando:
        print(f"  !!  {alvo:<36} -> NÃO ENCONTRADO")
    if ambiguos:
        print("\n--- AMBÍGUOS (escolha manual necessária) ---")
        for alvo, cands in ambiguos.items():
            print(f"  {alvo}")
            for fname, lbl, tipo, kind in cands:
                print(f"      {fname}  [{tipo}] '{lbl}'  ({kind})")

    # 'Renda' pode ser simplesmente o valor padrão do negócio.
    if "Renda" in faltando:
        print("\n  NOTA: 'Renda' não existe como campo customizado —")
        print("        provavelmente é o campo padrão OPPORTUNITY (valor do negócio).")
        print("        Confirmar comparando um negócio ganho contra a planilha.")

    # ── 2. Valores de listas ──────────────────────────────────────────────
    print("\nLendo listas de valores (crm.deal.userfield.list)...")
    enums = bx.userfield_enum()
    print(f"  {len(enums)} campos do tipo lista")
    for alvo in ("[SDR] Motivo de perda", "[LC] Motivo de perda", "É renovação?"):
        fname = achados.get(alvo)
        if fname and fname in enums:
            vals = list(enums[fname].values())
            print(f"  {alvo}: {len(vals)} opções — ex.: {vals[:4]}")

    # ── 3. Etapas por funil ───────────────────────────────────────────────
    print("\nLendo etapas dos funis...")
    stages = {}
    for nome, cid in CATEGORIES.items():
        st = bx.stages(cid)
        stages[nome] = {"category_id": cid, "stages": st}
        print(f"\n  {nome} (categoryId={cid}) — {len(st)} etapas:")
        for sid, snome in st.items():
            print(f"      {sid:<28} {snome}")

    # ── 4. Fontes ─────────────────────────────────────────────────────────
    print("\nLendo fontes (crm.status.list ENTITY_ID=SOURCE)...")
    sources = bx.sources()
    print(f"  {len(sources)} fontes: {sorted(sources.values())}")

    # ── 5. Gravação ───────────────────────────────────────────────────────
    OUT.write_text(json.dumps({
        "campos":            achados,
        "campos_ambiguos":   {k: [c[0] for c in v] for k, v in ambiguos.items()},
        "campos_faltando":   faltando,
        "enums":             enums,
        "funis":             stages,
        "fontes":            sources,
        "funis_ambiguos":    CATEGORIES_AMBIGUAS,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n" + "=" * 64)
    print(f"Gravado em {OUT}  ({bx.call_count} chamadas à API)")
    print("\nPRÓXIMO PASSO — decisões humanas pendentes:")
    for cid, desc in CATEGORIES_AMBIGUAS.items():
        print(f"  [ ] funil {cid}: {desc}")
    print("  [ ] Classificar cada STAGE_ID acima como ganho / perdido / ativo")
    print("      (isso substitui os nomes de etapa do extract.py, que quebram ao renomear)")
    if faltando or ambiguos:
        print("  [ ] Resolver os campos marcados com !! ou listados como ambíguos")


if __name__ == "__main__":
    main()
