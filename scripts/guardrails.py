"""
Guard-rails: compara o data.js recém-gerado com o anterior e falha se algo
parecer quebrado.

    python scripts/guardrails.py <data.anterior.js> <data.novo.js>

Existe porque o modo de falha deste pipeline é SILENCIOSO. Quando uma etapa é
renomeada no Bitrix ou um campo customizado muda de nome, o número simplesmente
cai — sem exceção, sem log de erro. Já aconteceu: 'Perdido' virou
'Perdido - sem reunião' e 2.772 leads sumiram da contagem (CLAUDE.md §3.1).

Meses fechados não deveriam mudar. O mês corrente só cresce.
"""

import json
import re
import sys
from pathlib import Path

# Queda percentual tolerada num mês já fechado antes de abortar.
TOLERANCIA_QUEDA = 0.30

# Campos cuja queda brusca indica quebra de mapeamento.
CAMPOS_VIGIADOS = ("leads_total", "leads_sdr", "leads_closer", "qtd_v", "rec_v")


def carregar(caminho: str, nome_export: str = "DATA") -> list:
    txt = Path(caminho).read_text(encoding="utf-8")
    m = re.search(rf"export const {nome_export} = (\[.*?\]);", txt, re.S)
    if not m:
        raise SystemExit(f"ERRO: não achei 'export const {nome_export}' em {caminho}")
    return json.loads(m.group(1))


def checar_congelados(novo: list, caminho: str, problemas: list):
    """
    Mês congelado não pode mudar. É a garantia de que o número que a diretoria
    viu em março continua sendo o de março, mesmo que o negócio seja editado
    ou excluído no CRM depois.
    """
    p = Path(caminho)
    if not p.exists():
        return
    congelados = json.loads(p.read_text(encoding="utf-8")).get("DATA") or {}
    if not congelados:
        return
    por_ym = {m["ym"]: m for m in novo}
    divergentes = 0
    for ym, registro in congelados.items():
        atual = por_ym.get(ym)
        if atual is None:
            problemas.append(f"{ym}: está congelado mas sumiu do data.js")
        elif atual != registro:
            divergentes += 1
            campos = sorted(
                k for k in set(registro) | set(atual)
                if registro.get(k) != atual.get(k)
            )
            problemas.append(
                f"{registro.get('label', ym)}: mês CONGELADO foi alterado "
                f"(campos: {', '.join(campos[:6])}{'...' if len(campos) > 6 else ''})"
            )
    if not divergentes:
        print(f"  {len(congelados)} meses congelados conferidos — todos intactos.")


def main():
    if len(sys.argv) not in (3, 4):
        raise SystemExit(__doc__)
    anterior_path, novo_path = sys.argv[1], sys.argv[2]
    congelados_path = sys.argv[3] if len(sys.argv) == 4 else None

    novo = carregar(novo_path)
    novo_termino = carregar(novo_path, "DATA_TERMINO")

    problemas = []
    if congelados_path:
        checar_congelados(novo, congelados_path, problemas)

    # ── Checagens absolutas (não dependem do arquivo anterior) ────────────
    if not novo:
        problemas.append("DATA está vazio — a extração não produziu nenhum mês.")
    if not novo_termino:
        problemas.append("DATA_TERMINO está vazio.")

    for mes in novo:
        if mes.get("leads_total", 0) <= 0:
            problemas.append(f"{mes['label']}: leads_total = 0 (funil vazio ou filtro quebrado)")

    # ── Comparação com a versão anterior ──────────────────────────────────
    try:
        anterior = carregar(anterior_path)
    except SystemExit:
        print("AVISO: data.js anterior ilegível — rodando só as checagens absolutas.")
        anterior = []

    if anterior:
        ant_por_ym = {m["ym"]: m for m in anterior}
        novo_por_ym = {m["ym"]: m for m in novo}

        sumidos = sorted(set(ant_por_ym) - set(novo_por_ym))
        if sumidos:
            problemas.append(f"Meses que existiam e sumiram do data.js: {sumidos}")

        # O último mês do arquivo anterior é o "corrente" — ele legitimamente
        # ainda está crescendo, então não cobramos estabilidade dele.
        ultimo_ym = anterior[-1]["ym"]

        for ym, mes_ant in ant_por_ym.items():
            mes_novo = novo_por_ym.get(ym)
            if not mes_novo or ym == ultimo_ym:
                continue
            for campo in CAMPOS_VIGIADOS:
                antes = mes_ant.get(campo) or 0
                agora = mes_novo.get(campo) or 0
                if antes <= 0:
                    continue
                queda = (antes - agora) / antes
                if queda > TOLERANCIA_QUEDA:
                    problemas.append(
                        f"{mes_ant['label']}: {campo} caiu {queda:.0%} "
                        f"({antes:,.0f} -> {agora:,.0f})"
                    )

    # ── Veredito ──────────────────────────────────────────────────────────
    if problemas:
        print("GUARD-RAILS: REPROVADO\n")
        for p in problemas:
            print(f"  x {p}")
        print(
            "\nO data.js NÃO será commitado. O site segue servindo o último dado bom.\n"
            "Causas prováveis, em ordem de frequência:\n"
            "  1. Etapa renomeada/criada no Bitrix -> rodar scripts/discover_fields.py\n"
            "  2. Campo customizado renomeado -> idem\n"
            "  3. Funil novo que deveria entrar no escopo\n"
            "  4. Mês congelado alterado -> só deveria acontecer com\n"
            "     'python scripts/extract_bitrix.py --descongelar=AAAA-MM' explícito\n"
            "Se a queda for real e esperada, rode o workflow manualmente com\n"
            "'pular_guardrails' marcado."
        )
        sys.exit(1)

    print(f"GUARD-RAILS: OK — {len(novo)} meses, nenhuma anomalia detectada.")


if __name__ == "__main__":
    main()
