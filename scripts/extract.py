"""
TLJ Dashboard — Data Extraction Script
Reads Excel files from Reports/ and writes src/data/data.js
Run: python scripts/extract.py

REGRA UNIVERSAL (todos os pipelines):
  Volume (leads/propostas)  = IDs com 'Criado' no mês
  Ganhos/Perdidos do mês    = filtro por 'Data de fechamento' + Fase=Ganho/Perdido

Column mapping (verified 2026-06-01):
  SDR/Closer/Rent: 'Criado' = data de criação (volume)
  Closer:          'Data de fechamento' = data de ganho/perda para vendas do mês
  Rent:            'Data de fechamento' = data de ganho para incrementos do mês
  Licenças:        '[LC] Data de vencimento' = data de referência para KPIs de CS
                   Ganho = '11 - Renovado' | Perdido = '10 - Cancelado', '12 - Renovado com concorrente', '13- Não está usando...'
  Inv:             Row 5 = 'Total Investido Mês', columns like 'jan/25', 'abr/26'
  ROI:             (rec_v - inv) / inv  (Net ROI — lucro bruto / investimento)
"""

import pandas as pd
import json
from pathlib import Path

ROOT    = Path(__file__).parent.parent
REPORTS = ROOT / "Reports"
OUTPUT  = ROOT / "src" / "data" / "data.js"

FILE_CLOSER       = REPORTS / "BASE CLOSER - MODIFICADO 2025 a 22.07.25.xlsx"
FILE_SDR          = REPORTS / "BASE SDR - MODIFICADO 2025 a 22.07.2026.xlsx"
FILE_RENT         = REPORTS / "BASE RENTABILIZAÇÂO COMPLETA - 22.07.2026.xlsx"
FILE_LC           = REPORTS / "BASE LICENCAS TODA - 22.07.2026.xlsx"
FILE_INV          = REPORTS / "INVESTIMENTOS.xlsx"
FILE_FONTES_PAGAS = REPORTS / "FontesPagas.xlsx"

# SDR phases treated as Perdido (phase names changed in new files)
FASES_PERDIDO_SDR = {'Perdido', 'Nutrição', 'Base de Oportunidade - Nutrição', 'Parar promocoes'}

# Licenças CS — fases de sucesso e churn
FASES_LC_RENOVADO  = {'11 - Renovado'}
FASES_LC_CANCELADO = {'10 - Cancelado', '12 - Renovado com concorrente',
                      '13- Não está usando e não se adatpitou'}

# Rentabilização — fases tratadas como Perdido no gráfico "Evolução de Valor
# Rentabilização (Expansão)". 'Duplicados' é excluído do total (não é oportunidade real).
FASES_PERDIDO_RENT = {'Proposta Perdida', 'Finalizado sem oportunidade de venda',
                       'Não Renovou a Licença'}
FASE_EXCLUIR_RENT = {'Duplicados'}

# All months to process — skip months with no data
ALL_MONTHS = [
    ("2025-01","Jan/25"), ("2025-02","Fev/25"), ("2025-03","Mar/25"),
    ("2025-04","Abr/25"), ("2025-05","Mai/25"), ("2025-06","Jun/25"),
    ("2025-07","Jul/25"), ("2025-08","Ago/25"), ("2025-09","Set/25"),
    ("2025-10","Out/25"), ("2025-11","Nov/25"), ("2025-12","Dez/25"),
    ("2026-01","Jan/26"), ("2026-02","Fev/26"), ("2026-03","Mar/26"),
    ("2026-04","Abr/26"), ("2026-05","Mai/26"), ("2026-06","Jun/26"),
    ("2026-07","Jul/26"),
]

# Month label → YYYY-MM map (for investments)
_MES_PT = {
    'jan':'01','fev':'02','mar':'03','abr':'04','mai':'05','jun':'06',
    'jul':'07','ago':'08','set':'09','out':'10','nov':'11','dez':'12'
}


def _ym(label: str) -> str:
    """Convert 'jan/25' → '2025-01'"""
    parts = label.lower().split('/')
    if len(parts) != 2:
        return ''
    m, y = parts
    year = '20' + y if len(y) == 2 else y
    return f"{year}-{_MES_PT.get(m[:3], '??')}"


def load_fontes_pagas() -> set:
    """Returns set of paid source names from FontesPagas.xlsx."""
    try:
        df = pd.read_excel(FILE_FONTES_PAGAS)
        pagas = df[df.iloc[:, 1].astype(str).str.strip() == 'Sim'].iloc[:, 0]
        return set(pagas.astype(str).str.strip().tolist())
    except Exception as e:
        print(f"  WARNING: Could not load FontesPagas.xlsx: {e}")
        return set()


def load_investments() -> dict:
    """Returns {ym: total_float} from INVESTIMENTOS.xlsx row 'Total Investido Mês'"""
    df = pd.read_excel(FILE_INV)
    # Last row = Total Investido Mês
    total_row = df.iloc[-1]
    inv_map = {}
    for col in df.columns:
        if col == 'Source':
            continue
        ym = _ym(str(col))
        if ym and '?' not in ym:
            try:
                val = float(total_row[col])
                if pd.notna(val):
                    inv_map[ym] = round(val, 2)
            except (ValueError, TypeError):
                pass
    return inv_map


def load_inv_breakdown() -> dict:
    """Returns {ym: {source_name: float}} for channel breakdown charts"""
    df = pd.read_excel(FILE_INV)
    result = {}
    channels = df['Source'].tolist()[:-1]  # exclude Total row
    for col in df.columns:
        if col == 'Source':
            continue
        ym = _ym(str(col))
        if not ym or '?' in ym:
            continue
        breakdown = {}
        for i, ch in enumerate(channels):
            try:
                val = float(df.iloc[i][col])
                if pd.notna(val) and val > 0:
                    breakdown[str(ch)] = round(val, 2)
            except (ValueError, TypeError):
                pass
        if breakdown:
            result[ym] = breakdown
    return result


def _vlookup_fonte(df, closer, label=''):
    """VLOOKUP: df.Empresa → Closer.Empresa → Closer.Fonte. Mutates df in-place."""
    if 'Empresa' in closer.columns and 'Fonte' in closer.columns and 'Empresa' in df.columns:
        empresa_fonte = {}
        for fase in ['Venda - Ganho', None]:
            subset = closer[closer['Fase'] == fase] if fase else closer
            for _, row in subset[['Empresa', 'Fonte']].dropna().iterrows():
                emp = str(row['Empresa']).strip()
                if emp and emp not in empresa_fonte:
                    empresa_fonte[emp] = str(row['Fonte']).strip()
        df['Fonte'] = (
            df['Empresa'].fillna('').astype(str).str.strip()
            .map(empresa_fonte)
            .fillna('Não identificado')
        )
        matched = (df['Fonte'] != 'Não identificado').sum()
        print(f"  VLOOKUP {label}->Closer: {matched}/{len(df)} registros com Fonte identificada")
    else:
        df['Fonte'] = 'Não identificado'


def load_dataframes():
    print("  Loading SDR...")
    sdr = pd.read_excel(FILE_SDR)
    sdr['dt']      = pd.to_datetime(sdr['Criado'],              errors='coerce')
    sdr['dt_fech'] = pd.to_datetime(sdr['Data de fechamento'],  errors='coerce')
    sdr['FaseAdj'] = sdr['Fase'].apply(
        lambda x: 'Perdido' if x in FASES_PERDIDO_SDR else x
    )

    print("  Loading Closer...")
    closer = pd.read_excel(FILE_CLOSER)
    closer['dt']      = pd.to_datetime(closer['Criado'],              errors='coerce')
    closer['dt_fech'] = pd.to_datetime(closer['Data de fechamento'],  errors='coerce')

    print("  Loading Rentabilização...")
    rent = pd.read_excel(FILE_RENT)
    rent['dt']       = pd.to_datetime(rent['Criado'],               errors='coerce')  # volume
    rent['dt_fech']  = pd.to_datetime(rent['Data de fechamento'],   errors='coerce')  # ganhos do mês
    _vlookup_fonte(rent, closer, label='Rent')

    print("  Loading Licenças CS...")
    lics = pd.read_excel(FILE_LC)
    lics['dt_venc'] = pd.to_datetime(lics['[LC] Data de vencimento'], errors='coerce')
    _vlookup_fonte(lics, closer, label='LC')

    return sdr, closer, rent, lics


def _safe_int(x):
    try:
        v = int(x)
        return v if pd.notna(x) else 0
    except Exception:
        return 0


def _motivos(df, col='[SDR] Motivo de perda', n=8):
    if col not in df.columns:
        return {}
    return {str(k): _safe_int(v) for k, v in df[col].value_counts().head(n).items()}


def _build_por_fonte(s, c, c_fechado, r_inc, r_ren):
    """
    Builds per-fonte breakdown dict combining SDR leads, Closer leads,
    won deals, incrementos, and renovações.
    Returns { fonte_name: { leads_sdr, leads_closer, qtd_v, rec_v, qtd_i, rec_i, qtd_r, rec_r } }
    """
    _empty = lambda: {
        'leads_sdr': 0, 'leads_closer': 0,
        'qtd_v': 0, 'rec_v': 0.0,
        'qtd_i': 0, 'rec_i': 0.0,
        'qtd_r': 0, 'rec_r': 0.0,
    }
    result = {}

    def _ensure(f):
        if f not in result:
            result[f] = _empty()

    # SDR leads by fonte
    if 'Fonte' in s.columns:
        for fonte, grp in s.groupby(s['Fonte'].fillna('Não identificado')):
            f = str(fonte).strip() or 'Não identificado'
            _ensure(f)
            result[f]['leads_sdr'] += len(grp)

    # Closer leads by fonte (criado)
    if 'Fonte' in c.columns:
        for fonte, grp in c.groupby(c['Fonte'].fillna('Não identificado')):
            f = str(fonte).strip() or 'Não identificado'
            _ensure(f)
            result[f]['leads_closer'] += len(grp)

    # Vendas fechadas by fonte
    if 'Fonte' in c_fechado.columns:
        for fonte, grp in c_fechado.groupby(c_fechado['Fonte'].fillna('Não identificado')):
            f = str(fonte).strip() or 'Não identificado'
            _ensure(f)
            result[f]['qtd_v'] += len(grp)
            result[f]['rec_v'] += float(round(grp['Renda'].sum(), 2))

    # Incrementos by fonte (VLOOKUP já aplicado)
    if 'Fonte' in r_inc.columns:
        for fonte, grp in r_inc.groupby(r_inc['Fonte'].fillna('Não identificado')):
            f = str(fonte).strip() or 'Não identificado'
            _ensure(f)
            result[f]['qtd_i'] += len(grp)
            result[f]['rec_i'] += float(round(grp['Renda'].sum(), 2))

    # Renovações by fonte (VLOOKUP já aplicado)
    if 'Fonte' in r_ren.columns:
        for fonte, grp in r_ren.groupby(r_ren['Fonte'].fillna('Não identificado')):
            f = str(fonte).strip() or 'Não identificado'
            _ensure(f)
            result[f]['qtd_r'] += len(grp)
            result[f]['rec_r'] += float(round(grp['Renda'].sum(), 2))

    return result


def _build_lc_fields(lics, y, m):
    """
    Computa métricas de Licenças CS para o mês y/m usando [LC] Data de vencimento.
    Ganho = FASES_LC_RENOVADO | Perdido = FASES_LC_CANCELADO
    """
    lc = lics[(lics['dt_venc'].dt.year == y) & (lics['dt_venc'].dt.month == m)]
    ren  = lc[lc['Fase'].isin(FASES_LC_RENOVADO)]
    can  = lc[lc['Fase'].isin(FASES_LC_CANCELADO)]
    lc_renovado   = len(ren)
    lc_cancelado  = len(can)
    lc_aberto     = max(len(lc) - lc_renovado - lc_cancelado, 0)
    lc_total      = len(lc)
    lc_rec_ren    = float(round(ren['Renda'].sum(), 2))
    lc_rec_can    = float(round(can['Renda'].sum(), 2))
    lc_taxa       = round(lc_renovado / (lc_renovado + lc_cancelado) * 100, 1) \
                    if (lc_renovado + lc_cancelado) > 0 else 0.0

    # Por responsável CS
    lc_resp = {}
    for nome in lc['Responsável'].dropna().unique():
        sub    = lc[lc['Responsável'] == nome]
        r_mask = sub['Fase'].isin(FASES_LC_RENOVADO)
        c_mask = sub['Fase'].isin(FASES_LC_CANCELADO)
        lc_resp[str(nome)] = {
            'total':        len(sub),
            'renovado':     int(r_mask.sum()),
            'cancelado':    int(c_mask.sum()),
            'aberto':       max(int(len(sub) - r_mask.sum() - c_mask.sum()), 0),
            'rec_renovado': float(round(sub[r_mask]['Renda'].sum(), 2)),
        }

    # Distribuição de uso do Bitrix
    bitrix_col = '[LC] Cliente está usando Bitrix?'
    lc_bitrix_uso = {}
    if bitrix_col in lc.columns and lc_total > 0:
        lc_bitrix_uso = {str(k): int(v)
                         for k, v in lc[bitrix_col].value_counts().head(6).items()}

    # Motivos de churn
    motivo_col = '[LC] Motivo de perda'
    lc_motivos_churn = {}
    if motivo_col in can.columns and len(can) > 0:
        lc_motivos_churn = {str(k): int(v)
                            for k, v in can[motivo_col].value_counts().head(8).items()}

    return {
        'lc_total':          lc_total,
        'lc_renovado':       lc_renovado,
        'lc_cancelado':      lc_cancelado,
        'lc_aberto':         lc_aberto,
        'lc_rec_renovado':   lc_rec_ren,
        'lc_rec_cancelado':  lc_rec_can,
        'lc_taxa_renovacao': lc_taxa,
        'lc_resp':           lc_resp,
        'lc_bitrix_uso':     lc_bitrix_uso,
        'lc_motivos_churn':  lc_motivos_churn,
    }


def build_month(ym, label, sdr, closer, rent, lics, inv_map, inv_breakdown):
    y, m = int(ym[:4]), int(ym[5:])

    # ─── VOLUME: IDs criados no mês (todos os pipelines) ─────────────────────
    s  = sdr[   (sdr['dt'].dt.year==y)    & (sdr['dt'].dt.month==m)]
    c  = closer[(closer['dt'].dt.year==y) & (closer['dt'].dt.month==m)]
    r_vol = rent[(rent['dt'].dt.year==y)  & (rent['dt'].dt.month==m)]

    ls, lc = len(s), len(c)

    # ─── PIPELINE HEALTH (por criação, para taxa_fech e análise de funil) ─────
    ganho   = _safe_int((c['Fase']=='Venda - Ganho').sum())
    perdido = _safe_int((c['Fase']=='Perdido').sum())
    aberto  = lc - ganho - perdido
    taxa_fech = round(ganho/(ganho+perdido)*100, 1) if ganho+perdido > 0 else 0.0

    # ─── VALOR GERENCIADO EM PROPOSTAS (por criação, status atual) ────────────
    # Mesma safra do pipeline health acima, mas em R$ em vez de contagem —
    # usado no gráfico "Evolução de Valor em Propostas" da aba Closers.
    valor_ganho_prop   = float(round(c[c['Fase']=='Venda - Ganho']['Renda'].sum(), 2))
    valor_perdido_prop = float(round(c[c['Fase']=='Perdido']['Renda'].sum(), 2))
    valor_total_prop   = float(round(c['Renda'].sum(), 2))
    valor_aberto_prop  = round(max(valor_total_prop - valor_ganho_prop - valor_perdido_prop, 0), 2)

    # ─── VALOR RENTABILIZAÇÃO / EXPANSÃO (por criação, status atual) ──────────
    # Mesma lógica acima, mas para a base de Rentabilização. Duplicados excluídos.
    r_vol_valid = r_vol[~r_vol['Fase'].isin(FASE_EXCLUIR_RENT)]
    rent_valor_ganho   = float(round(r_vol_valid[r_vol_valid['Fase']=='8 - Ganho']['Renda'].sum(), 2))
    rent_valor_perdido = float(round(r_vol_valid[r_vol_valid['Fase'].isin(FASES_PERDIDO_RENT)]['Renda'].sum(), 2))
    rent_valor_total   = float(round(r_vol_valid['Renda'].sum(), 2))
    rent_valor_aberto  = round(max(rent_valor_total - rent_valor_ganho - rent_valor_perdido, 0), 2)
    rent_qtd_ganho     = _safe_int((r_vol_valid['Fase']=='8 - Ganho').sum())
    rent_qtd_perdido   = _safe_int(r_vol_valid['Fase'].isin(FASES_PERDIDO_RENT).sum())
    rent_qtd_aberto    = max(len(r_vol_valid) - rent_qtd_ganho - rent_qtd_perdido, 0)

    # ─── VENDAS DO MÊS: por Data de fechamento (concluídas no mês) ───────────
    c_fechado = closer[
        (closer['dt_fech'].dt.year==y) &
        (closer['dt_fech'].dt.month==m) &
        (closer['Fase']=='Venda - Ganho')
    ]
    rec_v  = float(round(c_fechado['Renda'].sum(), 2))
    qtd_v  = len(c_fechado)
    ticket = round(rec_v / qtd_v, 2) if qtd_v > 0 else 0.0

    # ─── INCREMENTOS/RENOVAÇÕES: ganhos por Data de fechamento ───────────────
    r_fechado = rent[
        (rent['dt_fech'].dt.year==y) &
        (rent['dt_fech'].dt.month==m) &
        (rent['Fase']=='8 - Ganho')
    ]
    r_ren = r_fechado[r_fechado['É renovação?'] == 'Sim'] \
        if 'É renovação?' in rent.columns else r_fechado.iloc[0:0]
    r_inc = r_fechado[~r_fechado.index.isin(r_ren.index)]

    rec_i = float(round(r_inc['Renda'].sum(), 2))
    rec_r = float(round(r_ren['Renda'].sum(), 2))
    qtd_i = len(r_inc)   # ganhos do mês por dt_fech
    qtd_r = len(r_ren)

    # ─── MÉTRICAS DE EFICIÊNCIA ───────────────────────────────────────────────
    inv         = inv_map.get(ym, 0.0)
    roi         = round((rec_v - inv) / inv, 1) if inv > 0 else 0.0   # Net ROI
    lucro_bruto = round(rec_v - inv, 2)
    cac         = round(inv / qtd_v, 2) if qtd_v > 0 else 0.0
    cpl         = round(inv / (ls+lc), 2) if (ls+lc) > 0 else 0.0

    # SDR by responsible
    sdr_resp = {}
    for nome in sorted(s['Responsável'].dropna().unique()):
        sub_s = s[s['Responsável']==nome]
        sdr_resp[nome] = {
            'total':       len(sub_s),
            'conv_closer': _safe_int(len(c[c['#TLJ# SDR']==nome])),
            'perdido':     _safe_int(len(sub_s[sub_s['FaseAdj']=='Perdido'])),
        }

    # Closer by responsible
    closer_resp = {}
    for nome in sorted(c['Responsável'].dropna().unique()):
        sub_c = c[c['Responsável']==nome]
        g = _safe_int((sub_c['Fase']=='Venda - Ganho').sum())
        p = _safe_int((sub_c['Fase']=='Perdido').sum())
        closer_resp[nome] = {
            'total': len(sub_c), 'ganho': g,
            'perdido': p, 'aberto': len(sub_c)-g-p
        }

    # Revenue by closer — by Data de fechamento (vendas do mês)
    vendas_resp = {}
    for nome in c_fechado['Responsável'].dropna().unique():
        sub_g = c_fechado[c_fechado['Responsável']==nome]
        vendas_resp[nome] = {
            'qtd':    len(sub_g),
            'receita': float(round(sub_g['Renda'].sum(), 2))
        }

    # SDR→Closer funnel
    sdr_to_closer = {}
    for nome in c['#TLJ# SDR'].dropna().unique():
        if nome == '' or nome != nome:
            continue
        sub_fc = c[c['#TLJ# SDR']==nome]
        g2 = _safe_int((sub_fc['Fase']=='Venda - Ganho').sum())
        p2 = _safe_int((sub_fc['Fase']=='Perdido').sum())
        sdr_to_closer[str(nome)] = {
            'total': len(sub_fc), 'ganho': g2,
            'perdido': p2, 'aberto': len(sub_fc)-g2-p2
        }
    # Unattributed (no SDR)
    no_sdr = c[c['#TLJ# SDR'].isna() | (c['#TLJ# SDR']=='')]
    if len(no_sdr) > 0:
        g3 = _safe_int((no_sdr['Fase']=='Venda - Ganho').sum())
        p3 = _safe_int((no_sdr['Fase']=='Perdido').sum())
        sdr_to_closer['Não atrib.'] = {
            'total': len(no_sdr), 'ganho': g3,
            'perdido': p3, 'aberto': len(no_sdr)-g3-p3
        }

    # Propostas Perdidas — filter by dt_fech (Data de fechamento) in the month
    fp = closer[
        (closer['dt_fech'].dt.year==y) &
        (closer['dt_fech'].dt.month==m) &
        (closer['Fase']=='Perdido')
    ]
    pp_resp = {}
    for nome in fp['Responsável'].dropna().unique():
        sub_fp = fp[fp['Responsável']==nome]
        pp_resp[nome] = {
            'total':   len(sub_fp),
            'valor':   float(round(sub_fp['Renda'].sum(), 2)),
            'motivos': _motivos(sub_fp)
        }

    # SDR/Closer motivos per responsible (for drill-down in current month)
    sdr_mp = {}
    for nome in s[s['FaseAdj']=='Perdido']['Responsável'].dropna().unique():
        sub_sp = s[(s['Responsável']==nome) & (s['FaseAdj']=='Perdido')]
        if len(sub_sp) > 0:
            sdr_mp[nome] = _motivos(sub_sp)

    closer_mp = {}
    for nome in c[c['Fase']=='Perdido']['Responsável'].dropna().unique():
        sub_cp = c[(c['Responsável']==nome) & (c['Fase']=='Perdido')]
        if len(sub_cp) > 0:
            closer_mp[nome] = _motivos(sub_cp)

    return {
        'ym': ym, 'label': label,
        'leads_sdr':    ls,
        'leads_closer': lc,
        'leads_total':  ls + lc,
        'reunioes':     lc,
        'sdr_perdido':  _safe_int((s['FaseAdj']=='Perdido').sum()),
        'sdr_ativo':    _safe_int(len(s[~s['FaseAdj'].isin({'Perdido','Reunião Realizada'})])),
        'ganho':        ganho,
        'perdido':      perdido,
        'aberto':       max(aberto, 0),
        'taxa_fech':    taxa_fech,
        'valor_ganho_prop':   valor_ganho_prop,
        'valor_perdido_prop': valor_perdido_prop,
        'valor_aberto_prop':  valor_aberto_prop,
        'valor_total_prop':   valor_total_prop,
        'rent_valor_ganho':   rent_valor_ganho,
        'rent_valor_perdido': rent_valor_perdido,
        'rent_valor_aberto':  rent_valor_aberto,
        'rent_valor_total':   rent_valor_total,
        'rent_qtd_ganho':     rent_qtd_ganho,
        'rent_qtd_perdido':   rent_qtd_perdido,
        'rent_qtd_aberto':    rent_qtd_aberto,
        'rec_v':        rec_v,
        'qtd_v':        qtd_v,
        'rec_i':        rec_i,
        'qtd_i':        qtd_i,
        'rec_r':        rec_r,
        'qtd_r':        qtd_r,
        'ticket':       ticket,
        'inv':          inv,
        'roi':          roi,
        'lucro_bruto':  lucro_bruto,
        'cac':          cac,
        'cpl':          cpl,
        'inv_breakdown': inv_breakdown.get(ym, {}),
        'fonte_sdr':    {str(k): _safe_int(v) for k, v in s['Fonte'].value_counts().head(8).items()},
        'mp_sdr':       _motivos(s[s['FaseAdj']=='Perdido']),
        'mp_closer':    _motivos(c[c['Fase']=='Perdido']),
        'sdr_resp':     sdr_resp,
        'closer_resp':  closer_resp,
        'vendas_resp':  vendas_resp,
        'sdr_to_closer': sdr_to_closer,
        'sdr_mp_resp':  sdr_mp,
        'closer_mp_resp': closer_mp,
        'pp': {
            'total':       len(fp),
            'valor':       float(round(fp['Renda'].sum(), 2)),
            'por_resp':    pp_resp,
            'motivos_geral': _motivos(fp),
        },
        'por_fonte': _build_por_fonte(s, c, c_fechado, r_inc, r_ren),
        **_build_lc_fields(lics, y, m),
    }


def build_month_termino(ym, label, sdr, closer, rent, lics, inv_map, inv_breakdown):
    """
    Monthly record indexed by DATA DE FECHAMENTO (close month).
    All aggregations use dt_fech as the primary filter.
    Used for DATA_TERMINO — the 'Data de Término' filter mode.
    """
    y, m = int(ym[:4]), int(ym[5:])

    # Closer deals CLOSED this month
    c_ganho   = closer[(closer['dt_fech'].dt.year==y) & (closer['dt_fech'].dt.month==m) & (closer['Fase']=='Venda - Ganho')]
    c_perdido = closer[(closer['dt_fech'].dt.year==y) & (closer['dt_fech'].dt.month==m) & (closer['Fase']=='Perdido')]
    c_all     = closer[(closer['dt_fech'].dt.year==y) & (closer['dt_fech'].dt.month==m)]

    # SDR leads that became Perdido this month (by close date)
    s_perdido = sdr[(sdr['dt_fech'].dt.year==y) & (sdr['dt_fech'].dt.month==m) & (sdr['FaseAdj']=='Perdido')] \
        if 'dt_fech' in sdr.columns else sdr.iloc[0:0]

    lc = len(c_all)
    ls = len(s_perdido)  # SDR terminated this month
    ganho   = len(c_ganho)
    perdido = len(c_perdido)
    aberto  = lc - ganho - perdido
    taxa_fech = round(ganho/(ganho+perdido)*100, 1) if ganho+perdido > 0 else 0.0

    rec_v  = float(round(c_ganho['Renda'].sum(), 2))
    qtd_v  = ganho
    ticket = round(rec_v / qtd_v, 2) if qtd_v > 0 else 0.0

    r_fechado = rent[(rent['dt_fech'].dt.year==y) & (rent['dt_fech'].dt.month==m) & (rent['Fase']=='8 - Ganho')]
    r_ren = r_fechado[r_fechado['É renovação?'] == 'Sim'] \
        if 'É renovação?' in rent.columns else r_fechado.iloc[0:0]
    r_inc = r_fechado[~r_fechado.index.isin(r_ren.index)]

    rec_i = float(round(r_inc['Renda'].sum(), 2))
    rec_r = float(round(r_ren['Renda'].sum(), 2))
    qtd_i = len(r_inc)
    qtd_r = len(r_ren)

    inv         = inv_map.get(ym, 0.0)
    roi         = round((rec_v - inv) / inv, 1) if inv > 0 else 0.0
    lucro_bruto = round(rec_v - inv, 2)
    cac         = round(inv / qtd_v, 2) if qtd_v > 0 else 0.0
    cpl         = round(inv / (ls+lc), 2) if (ls+lc) > 0 else 0.0

    vendas_resp = {}
    for nome in c_ganho['Responsável'].dropna().unique():
        sub_g = c_ganho[c_ganho['Responsável']==nome]
        vendas_resp[nome] = {'qtd': len(sub_g), 'receita': float(round(sub_g['Renda'].sum(), 2))}

    closer_resp = {}
    for nome in sorted(c_all['Responsável'].dropna().unique()):
        sub_c = c_all[c_all['Responsável']==nome]
        g = _safe_int((sub_c['Fase']=='Venda - Ganho').sum())
        p = _safe_int((sub_c['Fase']=='Perdido').sum())
        closer_resp[nome] = {'total': len(sub_c), 'ganho': g, 'perdido': p, 'aberto': len(sub_c)-g-p}

    closer_mp = {}
    for nome in c_perdido['Responsável'].dropna().unique():
        sub_cp = c_perdido[c_perdido['Responsável']==nome]
        if len(sub_cp) > 0:
            closer_mp[nome] = _motivos(sub_cp)

    pp_resp = {}
    for nome in c_perdido['Responsável'].dropna().unique():
        sub_fp = c_perdido[c_perdido['Responsável']==nome]
        pp_resp[nome] = {'total': len(sub_fp), 'valor': float(round(sub_fp['Renda'].sum(), 2)), 'motivos': _motivos(sub_fp)}

    return {
        'ym': ym, 'label': label,
        'leads_sdr':    ls,
        'leads_closer': lc,
        'leads_total':  ls + lc,
        'reunioes':     lc,
        'sdr_perdido':  ls,
        'sdr_ativo':    0,
        'ganho':        ganho,
        'perdido':      perdido,
        'aberto':       max(aberto, 0),
        'taxa_fech':    taxa_fech,
        'rec_v':        rec_v,
        'qtd_v':        qtd_v,
        'rec_i':        rec_i,
        'qtd_i':        qtd_i,
        'rec_r':        rec_r,
        'qtd_r':        qtd_r,
        'ticket':       ticket,
        'inv':          inv,
        'roi':          roi,
        'lucro_bruto':  lucro_bruto,
        'cac':          cac,
        'cpl':          cpl,
        'inv_breakdown': inv_breakdown.get(ym, {}),
        'fonte_sdr':    {},
        'mp_sdr':       {},
        'mp_closer':    _motivos(c_perdido),
        'sdr_resp':     {},
        'closer_resp':  closer_resp,
        'vendas_resp':  vendas_resp,
        'sdr_to_closer': {},
        'sdr_mp_resp':  {},
        'closer_mp_resp': closer_mp,
        'pp': {
            'total': len(c_perdido),
            'valor': float(round(c_perdido['Renda'].sum(), 2)),
            'por_resp': pp_resp,
            'motivos_geral': _motivos(c_perdido),
        },
        'por_fonte': _build_por_fonte(sdr.iloc[0:0], c_all, c_ganho, r_inc, r_ren),
        **_build_lc_fields(lics, y, m),
    }


def main():
    print("TLJ Dashboard — Data Extraction")
    print("=" * 50)

    print("Loading fontes pagas...")
    fontes_pagas = load_fontes_pagas()
    print(f"  {len(fontes_pagas)} fontes pagas: {sorted(fontes_pagas)}")

    print("Loading investment data...")
    inv_map       = load_investments()
    inv_breakdown = load_inv_breakdown()
    print(f"  Found investments for {len(inv_map)} months: {sorted(inv_map.keys())}")

    print("Loading CRM data...")
    sdr, closer, rent, lics = load_dataframes()
    print(f"  SDR:      {len(sdr)} records")
    print(f"  Closer:   {len(closer)} records")
    print(f"  Rent:     {len(rent)} records ({(rent['Fase']=='8 - Ganho').sum()} ganhos)")
    print(f"  Licenças: {len(lics)} records ({lics['Fase'].isin(FASES_LC_RENOVADO).sum()} renovadas, "
          f"{lics['Fase'].isin(FASES_LC_CANCELADO).sum()} canceladas)")

    monthly = []
    monthly_termino = []
    for ym, label in ALL_MONTHS:
        y, m = int(ym[:4]), int(ym[5:])
        has_sdr    = ((sdr['dt'].dt.year==y)    & (sdr['dt'].dt.month==m)).any()
        has_closer = ((closer['dt'].dt.year==y) & (closer['dt'].dt.month==m)).any()
        if not has_sdr and not has_closer:
            print(f"  Skipping {label} (no data)")
            continue
        print(f"  Processing {label}...", end='  ')
        try:
            row = build_month(ym, label, sdr, closer, rent, lics, inv_map, inv_breakdown)
            monthly.append(row)
            lc_info = f", lc_ren={row['lc_renovado']}/can={row['lc_cancelado']}" if row['lc_total'] > 0 else ''
            print(f"leads={row['leads_total']}, ganho={row['ganho']}, rec_v=R${row['rec_v']:,.0f}{lc_info}")
        except Exception as e:
            print(f"ERROR: {e}")
            import traceback; traceback.print_exc()

    print("\nBuilding DATA_TERMINO (by Data de fechamento / vencimento)...")
    for ym, label in ALL_MONTHS:
        y, m = int(ym[:4]), int(ym[5:])
        has_term  = ((closer['dt_fech'].dt.year==y) & (closer['dt_fech'].dt.month==m)).any()
        has_lc    = ((lics['dt_venc'].dt.year==y)   & (lics['dt_venc'].dt.month==m)).any()
        if not has_term and not has_lc:
            continue
        try:
            row_t = build_month_termino(ym, label, sdr, closer, rent, lics, inv_map, inv_breakdown)
            if row_t['leads_total'] > 0 or row_t['rec_v'] > 0 or row_t['lc_total'] > 0:
                monthly_termino.append(row_t)
        except Exception as e:
            print(f"  ERROR {label}: {e}")

    if not monthly:
        print("ERROR: No months processed. Check file paths.")
        return

    # Validation checkpoint — compare against reference prints
    print("\n=== VALIDATION vs REFERÊNCIA ===")
    refs = {
        '2026-01': dict(leads=188, qtd_v=9, rec_v=91663.40, roi=11.94, inv=7081.41),
        '2026-02': dict(leads=223, qtd_v=7, rec_v=98942.00, roi=12.11, inv=7544.40),
        '2026-03': dict(leads=228, qtd_v=4, rec_v=67021.60, roi=4.10,  inv=13153.68),
        '2026-04': dict(leads=135, qtd_v=4, rec_v=42448.20, roi=3.94,  inv=8584.30),
    }
    for ym_r, exp in refs.items():
        got = next((m for m in monthly if m['ym']==ym_r), None)
        if not got:
            print(f"  {ym_r}: NOT FOUND in output!")
            continue
        ok_leads = abs(got['leads_total'] - exp['leads']) <= 5
        ok_v     = abs(got['qtd_v']       - exp['qtd_v']) <= 1
        ok_rec   = abs(got['rec_v']        - exp['rec_v']) <= 500
        ok_roi   = abs(got['roi']          - exp['roi'])   <= 0.5
        status   = "OK" if all([ok_leads, ok_v, ok_rec, ok_roi]) else "!!"
        print(f"  {status} {ym_r}: leads={got['leads_total']} (exp:{exp['leads']}) "
              f"| qtd_v={got['qtd_v']} (exp:{exp['qtd_v']}) "
              f"| rec_v=R${got['rec_v']:,.0f} (exp:R${exp['rec_v']:,.0f}) "
              f"| roi={got['roi']}x (exp:{exp['roi']}x)")

    # Write output — two named exports
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    first, last = monthly[0]['label'], monthly[-1]['label']
    content = (
        f"// AUTO-GENERATED by scripts/extract.py — DO NOT EDIT MANUALLY\n"
        f"// Last updated: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')}\n"
        f"// DATA:        {first} → {last} ({len(monthly)} months, by Criado)\n"
        f"// DATA_TERMINO: {monthly_termino[0]['label'] if monthly_termino else '?'} → {monthly_termino[-1]['label'] if monthly_termino else '?'} ({len(monthly_termino)} months, by dt_fech)\n\n"
        f"export const DATA = {json.dumps(monthly, ensure_ascii=False, indent=2)};\n\n"
        f"export const DATA_TERMINO = {json.dumps(monthly_termino, ensure_ascii=False, indent=2)};\n\n"
        f"export const FONTES_PAGAS = {json.dumps(sorted(fontes_pagas), ensure_ascii=False)};\n"
    )
    OUTPUT.write_text(content, encoding='utf-8')
    print(f"\nWrote {len(monthly)} months (DATA) + {len(monthly_termino)} months (DATA_TERMINO) to {OUTPUT}")
    print("Done!")


if __name__ == "__main__":
    main()
