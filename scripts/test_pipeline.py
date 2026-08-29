"""Testes do pipeline Bitrix sem precisar de credencial — dados sintéticos."""
import json, sys, subprocess
from pathlib import Path
AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))

import pandas as pd
import extract_bitrix as eb

falhas = []
def check(nome, cond, detalhe=""):
    print(f"  {'OK ' if cond else 'FALHOU'}  {nome}{'' if cond else '  <- ' + str(detalhe)}")
    if not cond:
        falhas.append(nome)

print("\n1. _url_csv")
u = eb._url_csv("https://docs.google.com/spreadsheets/d/1IJBF_4iPGx8Xk8lDIt-KK-Wv_S7AkE2b/edit?gid=1002693880#gid=1002693880")
check("URL real do usuário", u == "https://docs.google.com/spreadsheets/d/1IJBF_4iPGx8Xk8lDIt-KK-Wv_S7AkE2b/export?format=csv&gid=1002693880", u)
check("sem gid vira 0", eb._url_csv("https://docs.google.com/spreadsheets/d/ABC123/edit").endswith("gid=0"))

print("\n2. _para_reais (CSV pt-BR)")
s = eb._para_reais(pd.Series(["R$ 4.998,02", "R$ 13.153,68", "R$ -", "", "R$ 578,40"]))
check("R$ 4.998,02 -> 4998.02", abs(s[0] - 4998.02) < 0.001, s[0])
check("R$ 13.153,68 -> 13153.68", abs(s[1] - 13153.68) < 0.001, s[1])
check("'R$ -' vira NaN", pd.isna(s[2]), s[2])
check("R$ 578,40 -> 578.40", abs(s[4] - 578.40) < 0.001, s[4])

print("\n3. _ym do extract.py (cabeçalhos da planilha)")
import extract as legado
check("jan/25 -> 2025-01", legado._ym("jan/25") == "2025-01")
check("jul/26 -> 2026-07", legado._ym("jul/26") == "2026-07")

print("\n4. montar_df + build_month ponta a ponta")
mapa = {
    "campos": {
        "#TLJ# SDR": "UF_CRM_SDR", "[SDR] Motivo de perda": "UF_CRM_MP",
        "É renovação?": "UF_CRM_REN", "[LC] Data de vencimento": "UF_CRM_VENC",
        "[LC] Motivo de perda": "UF_CRM_LCMP",
        "[LC] Cliente está usando Bitrix?": "UF_CRM_USO",
    },
    "enums": {"UF_CRM_MP": {"1": "Card Duplicado", "2": "Sem Contato / Sem Resposta"},
              "UF_CRM_REN": {"10": "Sim", "11": "Não"}},
    "funis": {
        "sdr":      {"category_id": 0,   "canonico": {"C0:NEW": "Entrada", "C0:LOSE": "Perdido - sem reunião"}},
        "closer":   {"category_id": 107, "canonico": {"C107:WON": "Venda - Ganho", "C107:LOSE": "Perdido", "C107:NEW": "Enviar proposta"}},
        "rent":     {"category_id": 103, "canonico": {"C103:WON": "8 - Ganho"}},
        "licencas": {"category_id": 129, "canonico": {"C129:WON": "11 - Renovado", "C129:LOSE": "10 - Cancelado"}},
    },
}
usuarios = {"45465": "Ana Closer", "55187": "Bruno SDR"}
fontes   = {"183": "Google Ads", "1": "WhatsApp"}
empresas = {"900": "ACME LTDA"}

def deal(i, stage, cat, criado, fecha, valor, resp="45465", src="183", **uf):
    d = {"ID": str(i), "STAGE_ID": stage, "CATEGORY_ID": str(cat),
         "DATE_CREATE": criado, "CLOSEDATE": fecha, "OPPORTUNITY": str(valor),
         "ASSIGNED_BY_ID": resp, "SOURCE_ID": src, "COMPANY_ID": "900"}
    d.update(uf); return d

sdr_raw = [
    deal(1, "C0:NEW",  0, "2026-07-05T10:00:00+03:00", None, 0, resp="55187"),
    deal(2, "C0:LOSE", 0, "2026-07-06T10:00:00+03:00", "2026-07-20T10:00:00+03:00", 0,
         resp="55187", UF_CRM_MP="1"),
    deal(3, "C0:LOSE", 0, "2026-07-07T10:00:00+03:00", "2026-07-21T10:00:00+03:00", 0,
         resp="55187", UF_CRM_MP="2"),
]
closer_raw = [
    deal(10, "C107:WON",  107, "2026-07-02T10:00:00+03:00", "2026-07-15T10:00:00+03:00", 10000,
         UF_CRM_SDR="Bruno SDR"),
    deal(11, "C107:LOSE", 107, "2026-07-03T10:00:00+03:00", "2026-07-18T10:00:00+03:00", 5000,
         UF_CRM_MP="2"),
    deal(12, "C107:NEW",  107, "2026-07-04T10:00:00+03:00", None, 7000),
]
rent_raw = [deal(20, "C103:WON", 103, "2026-07-01T10:00:00+03:00", "2026-07-25T10:00:00+03:00", 3000, UF_CRM_REN="11")]
lic_raw  = [deal(30, "C129:WON", 129, "2026-06-01T10:00:00+03:00", None, 2000, UF_CRM_VENC="2026-07-10T00:00:00+03:00")]

dfs = {}
for nome, raw in [("sdr", sdr_raw), ("closer", closer_raw), ("rent", rent_raw), ("licencas", lic_raw)]:
    dfs[nome] = eb.montar_df(raw, mapa, nome, usuarios, fontes, empresas)

sdr, closer, rent, lics = dfs["sdr"], dfs["closer"], dfs["rent"], dfs["licencas"]
for df in (sdr, closer, rent):
    df["dt"], df["dt_fech"] = df["Criado"], df["Data de fechamento"]
sdr["FaseAdj"] = sdr["Fase"].apply(lambda x: "Perdido" if x in legado.FASES_PERDIDO_SDR else x)
lics["dt_venc"] = lics["[LC] Data de vencimento"]
legado._vlookup_fonte(rent, closer, label="Rent")
legado._vlookup_fonte(lics, closer, label="LC")

check("Fase canônica aplicada", closer["Fase"].tolist() == ["Venda - Ganho", "Perdido", "Enviar proposta"], closer["Fase"].tolist())
check("enum -> texto", sdr["[SDR] Motivo de perda"].tolist()[1] == "Card Duplicado", sdr["[SDR] Motivo de perda"].tolist())
check("Responsável resolvido", closer["Responsável"].iloc[0] == "Ana Closer", closer["Responsável"].iloc[0])
check("Fonte resolvida", closer["Fonte"].iloc[0] == "Google Ads", closer["Fonte"].iloc[0])
check("Empresa resolvida", closer["Empresa"].iloc[0] == "ACME LTDA", closer["Empresa"].iloc[0])
check("Renda de OPPORTUNITY", closer["Renda"].iloc[0] == 10000.0, closer["Renda"].iloc[0])
check("FaseAdj marca perdidos SDR", int((sdr["FaseAdj"] == "Perdido").sum()) == 2, sdr["FaseAdj"].tolist())

row = legado.build_month("2026-07", "Jul/26", sdr, closer, rent, lics, {"2026-07": 1000.0}, {})
check("leads_total = 3 SDR + 3 Closer", row["leads_total"] == 6, row["leads_total"])
check("ganho = 1", row["ganho"] == 1, row["ganho"])
check("perdido = 1", row["perdido"] == 1, row["perdido"])
check("qtd_v = 1", row["qtd_v"] == 1, row["qtd_v"])
check("rec_v = 10000", row["rec_v"] == 10000.0, row["rec_v"])
check("ROI net = (10000-1000)/1000 = 9.0", row["roi"] == 9.0, row["roi"])
check("descartados = 1 (Card Duplicado)", row["leads_descartados"] == 1, row["leads_descartados"])
check("leads_efetivos = 5", row["leads_efetivos"] == 5, row["leads_efetivos"])
check("qtd_i = 1 (incremento)", row["qtd_i"] == 1, row["qtd_i"])
check("lc_renovado = 1", row["lc_renovado"] == 1, row["lc_renovado"])
check("por_fonte soma leads_sdr", sum(v["leads_sdr"] for v in row["por_fonte"].values()) == row["leads_sdr"], row["por_fonte"])

rowt = legado.build_month_termino("2026-07", "Jul/26", sdr, closer, rent, lics, {"2026-07": 1000.0}, {})
check("termino qtd_v = 1", rowt["qtd_v"] == 1, rowt["qtd_v"])
check("termino pp.total = 1", rowt["pp"]["total"] == 1, rowt["pp"])

print("\n5. meses_disponiveis")
meses = eb.meses_disponiveis(sdr, closer)
check("vai de Jan/25 a Jul/26", meses[0] == ("2025-01", "Jan/25") and meses[-1] == ("2026-07", "Jul/26"), (meses[0], meses[-1]))
check("19 meses", len(meses) == 19, len(meses))

print("\n6. Fuso horário")
check("21h BRT de 31/jul fica em julho",
      eb._data(pd.Series(["2026-08-01T03:00:00+03:00"]))[0].month == 7,
      eb._data(pd.Series(["2026-08-01T03:00:00+03:00"]))[0])

print("\n7. guardrails")
def escrever(p, meses):
    Path(p).write_text(f"export const DATA = {json.dumps(meses)};\n\n"
                       f"export const DATA_TERMINO = {json.dumps(meses)};\n", encoding="utf-8")
base = [{"ym": "2026-06", "label": "Jun/26", "leads_total": 200, "leads_sdr": 100, "leads_closer": 100, "qtd_v": 5, "rec_v": 50000},
        {"ym": "2026-07", "label": "Jul/26", "leads_total": 180, "leads_sdr": 90, "leads_closer": 90, "qtd_v": 4, "rec_v": 40000}]
escrever("/tmp/a.js", base)
escrever("/tmp/b.js", base)
r = subprocess.run([sys.executable, str(AQUI / "guardrails.py"), "/tmp/a.js", "/tmp/b.js"], capture_output=True, text=True)
check("igual passa", r.returncode == 0, r.stdout + r.stderr)

quebrado = [dict(base[0], leads_total=20, leads_sdr=10, leads_closer=10), base[1]]
escrever("/tmp/c.js", quebrado)
r = subprocess.run([sys.executable, str(AQUI / "guardrails.py"), "/tmp/a.js", "/tmp/c.js"], capture_output=True, text=True)
check("queda de 90% reprova", r.returncode == 1, r.stdout)
check("mês corrente é isento", "Jul/26" not in r.stdout, r.stdout)

escrever("/tmp/d.js", [base[0]])
r = subprocess.run([sys.executable, str(AQUI / "guardrails.py"), "/tmp/a.js", "/tmp/d.js"], capture_output=True, text=True)
check("mês sumido reprova", r.returncode == 1 and "sumiram" in r.stdout, r.stdout)

print("\n8. diff_extracts")
r = subprocess.run([sys.executable, str(AQUI / "diff_extracts.py"), "/tmp/a.js", "/tmp/b.js"], capture_output=True, text=True)
check("idênticos liberam o portão", r.returncode == 0 and "PORTÃO LIBERADO" in r.stdout, r.stdout)
r = subprocess.run([sys.executable, str(AQUI / "diff_extracts.py"), "/tmp/a.js", "/tmp/c.js"], capture_output=True, text=True)
check("divergência fecha o portão", r.returncode == 1 and "PORTÃO FECHADO" in r.stdout, r.stdout[:400])

print("\n9. congelamento de meses fechados")
import importlib, tempfile, os
tmp = Path(tempfile.mkdtemp())
eb.CONGELADO = tmp / "meses_congelados.json"
meses19 = [(f"2026-{m:02d}", f"M{m}") for m in range(1, 8)]   # 2026-01 .. 2026-07
def rec(ym, leads): return {"ym": ym, "label": ym, "leads_total": leads}
frescos   = {ym: rec(ym, 100) for ym, _ in meses19}
frescos_t = {ym: rec(ym, 100) for ym, _ in meses19}

cong = eb.carregar_congelados()
check("arquivo ausente -> estrutura vazia", cong["DATA"] == {}, cong)
check("corte = 2 meses abertos", eb.limite_aberto(meses19) == "2026-06", eb.limite_aberto(meses19))

d1, t1 = eb.aplicar_congelamento(frescos, frescos_t, meses19, cong, set())
check("1a rodada devolve 7 meses", len(d1) == 7, len(d1))
check("congelou 01..05", sorted(cong["DATA"]) == ["2026-01","2026-02","2026-03","2026-04","2026-05"], sorted(cong["DATA"]))
check("06 e 07 ficam abertos", "2026-06" not in cong["DATA"] and "2026-07" not in cong["DATA"])
check("carimbo de data gravado", len(cong["_congelado_em"]) == 5, cong["_congelado_em"])

# Segunda rodada: o CRM "mudou" e todos os meses caem para 50.
frescos2 = {ym: rec(ym, 50) for ym, _ in meses19}
d2, _ = eb.aplicar_congelamento(frescos2, frescos2, meses19, cong, set())
por = {m["ym"]: m["leads_total"] for m in d2}
check("mês congelado ignora a mudança", por["2026-03"] == 100, por["2026-03"])
check("mês aberto acompanha a mudança", por["2026-07"] == 50, por["2026-07"])
check("mês anterior também é aberto", por["2026-06"] == 50, por["2026-06"])

# Descongelamento explícito
d3, _ = eb.aplicar_congelamento(frescos2, frescos2, meses19, cong, {"2026-03"})
por3 = {m["ym"]: m["leads_total"] for m in d3}
check("--descongelar reabre o mês", por3["2026-03"] == 50, por3["2026-03"])
check("e regrava o congelado", cong["DATA"]["2026-03"]["leads_total"] == 50, cong["DATA"]["2026-03"])
check("vizinhos seguem congelados", por3["2026-02"] == 100, por3["2026-02"])

print("\n10. guard-rail de mês congelado")
congf = tmp / "cong.json"
congf.write_text(json.dumps({"DATA": {"2026-06": {"ym":"2026-06","label":"Jun/26","leads_total":200,"leads_sdr":100,"leads_closer":100,"qtd_v":5,"rec_v":50000}}}), encoding="utf-8")
r = subprocess.run([sys.executable, str(AQUI/"guardrails.py"), "/tmp/a.js", "/tmp/a.js", str(congf)], capture_output=True, text=True)
check("congelado intacto passa", r.returncode == 0 and "intactos" in r.stdout, r.stdout)
congf.write_text(json.dumps({"DATA": {"2026-06": {"ym":"2026-06","label":"Jun/26","leads_total":999,"leads_sdr":100,"leads_closer":100,"qtd_v":5,"rec_v":50000}}}), encoding="utf-8")
r = subprocess.run([sys.executable, str(AQUI/"guardrails.py"), "/tmp/a.js", "/tmp/a.js", str(congf)], capture_output=True, text=True)
check("congelado alterado reprova", r.returncode == 1 and "CONGELADO foi alterado" in r.stdout, r.stdout)

print("\n" + "=" * 60)
print(f"{'TODOS OS TESTES PASSARAM' if not falhas else str(len(falhas)) + ' FALHA(S): ' + ', '.join(falhas)}")
sys.exit(1 if falhas else 0)
