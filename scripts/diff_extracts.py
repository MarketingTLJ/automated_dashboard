"""
FASE 3 — o portão. Compara o data.js gerado pelo Excel com o gerado pelo Bitrix.

    python scripts/extract.py            # gera pelo Excel
    cp src/data/data.js /tmp/data.excel.js
    python scripts/extract_bitrix.py     # gera pelo Bitrix
    python scripts/diff_extracts.py /tmp/data.excel.js src/data/data.js

Nada vai ao ar enquanto cada divergência não estiver zerada ou explicada por
escrito. É aqui que aparecem as surpresas: um lead que o Excel filtrava e a API
não, uma etapa que muda de nome entre os dois, o VLOOKUP de Empresa batendo
diferente, negócios de fim de mês caindo no mês vizinho por causa do fuso.
"""

import json
import re
import sys
from pathlib import Path

# Campos escalares comparados mês a mês.
ESCALARES = [
    "leads_sdr", "leads_closer", "leads_total", "leads_efetivos", "leads_descartados",
    "reunioes", "sdr_perdido", "sdr_ativo", "ganho", "perdido", "aberto", "taxa_fech",
    "rec_v", "qtd_v", "rec_i", "qtd_i", "rec_r", "qtd_r", "ticket",
    "inv", "roi", "lucro_bruto", "cac", "cpl",
    "valor_ganho_prop", "valor_perdido_prop", "valor_aberto_prop", "valor_total_prop",
    "rent_valor_ganho", "rent_valor_perdido", "rent_qtd_ganho", "rent_qtd_perdido",
    "lc_total", "lc_renovado", "lc_cancelado", "lc_rec_renovado", "lc_taxa_renovacao",
]

# Tolerância: contagens têm de bater exatamente; dinheiro aceita centavos.
TOL_DINHEIRO = 1.00
CAMPOS_DINHEIRO = {
    "rec_v", "rec_i", "rec_r", "ticket", "inv", "lucro_bruto", "cac", "cpl",
    "valor_ganho_prop", "valor_perdido_prop", "valor_aberto_prop", "valor_total_prop",
    "rent_valor_ganho", "rent_valor_perdido", "lc_rec_renovado",
}
TOL_TAXA = 0.15  # pontos percentuais (arredondamento em taxa_fech, roi, lc_taxa)
CAMPOS_TAXA = {"taxa_fech", "roi", "lc_taxa_renovacao"}


def carregar(caminho, nome="DATA"):
    txt = Path(caminho).read_text(encoding="utf-8")
    m = re.search(rf"export const {nome} = (\[.*?\]);", txt, re.S)
    if not m:
        raise SystemExit(f"Não achei '{nome}' em {caminho}")
    return {r["ym"]: r for r in json.loads(m.group(1))}


def diverge(campo, a, b):
    a = a or 0
    b = b or 0
    if campo in CAMPOS_DINHEIRO:
        return abs(a - b) > TOL_DINHEIRO
    if campo in CAMPOS_TAXA:
        return abs(a - b) > TOL_TAXA
    return a != b


def comparar_dicts(rotulo, d1, d2, achados, mes):
    """Compara dicionários por responsável/fonte/motivo (sdr_resp, por_fonte...)."""
    d1, d2 = d1 or {}, d2 or {}
    for chave in sorted(set(d1) | set(d2)):
        if chave not in d1:
            achados.append(f"{mes}  {rotulo}: '{chave}' só existe no Bitrix")
        elif chave not in d2:
            achados.append(f"{mes}  {rotulo}: '{chave}' só existe no Excel")
        else:
            v1, v2 = d1[chave], d2[chave]
            if isinstance(v1, dict) and isinstance(v2, dict):
                for sub in sorted(set(v1) | set(v2)):
                    if diverge(sub, v1.get(sub), v2.get(sub)):
                        achados.append(
                            f"{mes}  {rotulo}['{chave}'].{sub}: "
                            f"Excel={v1.get(sub)} Bitrix={v2.get(sub)}"
                        )
            elif diverge(rotulo, v1, v2):
                achados.append(f"{mes}  {rotulo}['{chave}']: Excel={v1} Bitrix={v2}")


def rodar(path_excel, path_bitrix, nome_export="DATA"):
    excel  = carregar(path_excel, nome_export)
    bitrix = carregar(path_bitrix, nome_export)

    print(f"\n{'=' * 68}\n{nome_export}\n{'=' * 68}")

    achados = []
    so_excel  = sorted(set(excel) - set(bitrix))
    so_bitrix = sorted(set(bitrix) - set(excel))
    if so_excel:
        achados.append(f"Meses só no Excel:  {so_excel}")
    if so_bitrix:
        achados.append(f"Meses só no Bitrix: {so_bitrix}")

    comuns = sorted(set(excel) & set(bitrix))
    for ym in comuns:
        e, b = excel[ym], bitrix[ym]
        mes = e.get("label", ym)
        linha = []
        for campo in ESCALARES:
            if campo in e or campo in b:
                if diverge(campo, e.get(campo), b.get(campo)):
                    linha.append(f"{campo}: Excel={e.get(campo)} Bitrix={b.get(campo)}")
        if linha:
            achados.append(f"{mes}")
            achados.extend(f"     {x}" for x in linha)

        for chave in ("sdr_resp", "closer_resp", "vendas_resp", "fonte_sdr",
                      "mp_sdr", "mp_closer", "lc_resp"):
            comparar_dicts(chave, e.get(chave), b.get(chave), achados, mes)

        pe, pb = e.get("pp") or {}, b.get("pp") or {}
        for campo in ("total", "valor"):
            if diverge(campo if campo != "valor" else "rec_v", pe.get(campo), pb.get(campo)):
                achados.append(f"{mes}  pp.{campo}: Excel={pe.get(campo)} Bitrix={pb.get(campo)}")

    if not achados:
        print(f"IDÊNTICOS — {len(comuns)} meses, {len(ESCALARES)} campos cada. Nenhuma divergência.")
        return 0

    print(f"{len(achados)} divergências em {len(comuns)} meses:\n")
    for a in achados:
        print(f"  {a}")
    return len(achados)


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    total = rodar(sys.argv[1], sys.argv[2], "DATA")
    total += rodar(sys.argv[1], sys.argv[2], "DATA_TERMINO")

    print(f"\n{'=' * 68}")
    if total == 0:
        print("PORTÃO LIBERADO — o Bitrix reproduz o Excel exatamente.")
        print("Pode seguir para a Fase 4 (GitHub Action).")
    else:
        print(f"PORTÃO FECHADO — {total} divergências.")
        print("\nSuspeitos habituais, em ordem:")
        print("  1. Fuso horário: negócios de fim de mês caindo no mês vizinho")
        print("     -> ajustar TIMEZONE em extract_bitrix.py")
        print("  2. Escopo de funil: 'SDR - Mineração' (135) dentro ou fora da BASE SDR")
        print("  3. Nome canônico de etapa divergindo do que o Excel exportava")
        print("     -> conferir o bloco 'canonico' em bitrix_map.json")
        print("  4. Campo de lista voltando ID em vez de texto (motivos de perda)")
        print("  5. Excel desatualizado: negócio editado no Bitrix depois da exportação")
        print("     -> este é o único caso em que a divergência é ESPERADA")
        sys.exit(1)


if __name__ == "__main__":
    main()
