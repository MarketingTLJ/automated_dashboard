import { useMemo } from 'react';
import { DATA, DATA_TERMINO } from '../data/data.js';
import { FONTES_PAGAS } from '../constants/index.js';

// ── Aggregation helpers ─────────────────────────────────────────────────────

// Sum flat key across array of month objects
const sumKey = (arr, k) => arr.reduce((s, d) => s + (d[k] || 0), 0);

// Merge { key: number } objects across months
function mergeKV(arr, field) {
  return arr.reduce((acc, d) => {
    Object.entries(d[field] || {}).forEach(([k, v]) => {
      acc[k] = (acc[k] || 0) + v;
    });
    return acc;
  }, {});
}

// Merge { name: { subKey: number } } (e.g. closer_resp, sdr_resp, vendas_resp)
function mergeNested(arr, field, subKeys) {
  return arr.reduce((acc, d) => {
    Object.entries(d[field] || {}).forEach(([name, stats]) => {
      if (!acc[name]) { acc[name] = {}; subKeys.forEach(k => { acc[name][k] = 0; }); }
      subKeys.forEach(k => { acc[name][k] += stats[k] || 0; });
    });
    return acc;
  }, {});
}

// Merge { name: { motivo: count } } (e.g. sdr_mp_resp, closer_mp_resp)
function mergeNestedKV(arr, field) {
  return arr.reduce((acc, d) => {
    Object.entries(d[field] || {}).forEach(([name, motivos]) => {
      if (!acc[name]) acc[name] = {};
      Object.entries(motivos || {}).forEach(([m, v]) => {
        acc[name][m] = (acc[name][m] || 0) + v;
      });
    });
    return acc;
  }, {});
}

// Merge pp objects: { total, valor, por_resp: { name: { total, valor, motivos } }, motivos_geral }
function mergePP(arr) {
  const r = { total: 0, valor: 0, por_resp: {}, motivos_geral: {} };
  arr.forEach(d => {
    const pp = d.pp || {};
    r.total += pp.total || 0;
    r.valor += pp.valor || 0;
    Object.entries(pp.por_resp || {}).forEach(([nome, s]) => {
      if (!r.por_resp[nome]) r.por_resp[nome] = { total: 0, valor: 0, motivos: {} };
      r.por_resp[nome].total += s.total || 0;
      r.por_resp[nome].valor += s.valor || 0;
      Object.entries(s.motivos || {}).forEach(([m, v]) => {
        r.por_resp[nome].motivos[m] = (r.por_resp[nome].motivos[m] || 0) + v;
      });
    });
    Object.entries(pp.motivos_geral || {}).forEach(([m, v]) => {
      r.motivos_geral[m] = (r.motivos_geral[m] || 0) + v;
    });
  });
  return r;
}

// Maps an array of month records into the flat shape used by trend charts
function buildTrend(arr) {
  return arr.map(d => ({
    mes:        d.label,
    vendas:     d.rec_v,
    inc:        d.rec_i,
    ren:        d.rec_r,
    leads:      d.leads_total,
    reunioes:   d.reunioes,
    ganho:      d.ganho,
    perdido:    d.perdido,
    aberto:     d.aberto,
    taxa_fech:  d.taxa_fech,
    taxa_geral: d.leads_total > 0 ? +((d.qtd_v / d.leads_total) * 100).toFixed(1) : 0,
    inv:        d.inv,
    roi:        d.roi,
    cpl:        d.cpl,
    ticket:     d.ticket,
    total_rec:  d.rec_v + d.rec_i + d.rec_r,
    pp:         d.pp,
    valor_ganho_prop:   d.valor_ganho_prop   ?? 0,
    valor_perdido_prop: d.valor_perdido_prop ?? 0,
    valor_aberto_prop:  d.valor_aberto_prop  ?? 0,
    valor_total_prop:   d.valor_total_prop   ?? 0,
    rent_valor_ganho:   d.rent_valor_ganho   ?? 0,
    rent_valor_perdido: d.rent_valor_perdido ?? 0,
    rent_valor_aberto:  d.rent_valor_aberto  ?? 0,
    rent_valor_total:   d.rent_valor_total   ?? 0,
    rent_qtd_ganho:     d.rent_qtd_ganho     ?? 0,
    rent_qtd_perdido:   d.rent_qtd_perdido   ?? 0,
    rent_qtd_aberto:    d.rent_qtd_aberto    ?? 0,
  }));
}

// Fixed last-6-months slice of DATA — independent of the date filters,
// used by charts that must always show a trailing 6-month trend (§ CLAUDE.md request).
const LAST6_RAW = DATA.slice(-6);

// Same calendar months as LAST6_RAW, one year earlier (e.g. Jan-Jun/26 → Jan-Jun/25).
// Missing months (no data that far back) are simply omitted.
const DATA_BY_YM = new Map(DATA.map(d => [d.ym, d]));
const ymPrevYear = ym => `${+ym.slice(0, 4) - 1}${ym.slice(4)}`;
const LAST6_PREV_YEAR_RAW = LAST6_RAW
  .map(d => DATA_BY_YM.get(ymPrevYear(d.ym)))
  .filter(Boolean);

// Builds the Investimento/Faturamento/Lucro Bruto + Leads/Vendas/Taxa/ROI/CAC
// series for the fixed Resumo Executivo / Investimentos comparison charts.
// withIncrementos=false → Novas Vendas only. withIncrementos=true → Novas Vendas + Incrementos.
// Fixed to the last 6 months (ignores date filters) — honors the fonte filter.
function buildInvestRevenue(arr, withIncrementos) {
  return arr.map(d => {
    const faturamento = withIncrementos ? d.rec_v + d.rec_i : d.rec_v;
    const qtd = withIncrementos ? d.qtd_v + d.qtd_i : d.qtd_v;
    const inv = d.inv;
    const lucro = +(faturamento - inv).toFixed(2);
    const roi = inv > 0 ? +((faturamento - inv) / inv).toFixed(2) : 0;
    const cac = qtd > 0 ? +(inv / qtd).toFixed(2) : 0;
    const taxa = d.leads_total > 0 ? +((qtd / d.leads_total) * 100).toFixed(1) : 0;
    // reunioes = leads_closer (regra de negócio) — usa o campo já filtrado por fonte
    return { mes: d.label, inv, faturamento, lucro, roi, cac, taxa, leads: d.leads_total, reunioes: d.leads_closer, qtd };
  });
}

// ── Fonte filter helpers ────────────────────────────────────────────────────

// Expand '__pagas__' sentinel to individual paid fonte names
function expandFontes(fonteFilter) {
  if (!fonteFilter.includes('__pagas__')) return fonteFilter;
  return [...new Set([
    ...fonteFilter.filter(f => f !== '__pagas__'),
    ...FONTES_PAGAS,
  ])];
}

/**
 * Returns a modified month record where lead/revenue metrics reflect only
 * the selected fontes. Derived metrics (ticket, roi, cac, cpl) are recalculated.
 * Fields not broken down by fonte (ganho, perdido, closer_resp, pp, etc.)
 * remain at their original totals — V1 scope.
 */
function applyFonteFilter(monthData, expandedFontes) {
  if (!expandedFontes.length) return monthData;
  const pf = monthData.por_fonte || {};

  let leads_sdr = 0, leads_closer = 0;
  let qtd_v = 0, rec_v = 0;
  let qtd_i = 0, rec_i = 0;
  let qtd_r = 0, rec_r = 0;

  expandedFontes.forEach(f => {
    const d = pf[f];
    if (!d) return;
    leads_sdr    += d.leads_sdr    || 0;
    leads_closer += d.leads_closer || 0;
    qtd_v        += d.qtd_v        || 0;
    rec_v        += d.rec_v        || 0;
    qtd_i        += d.qtd_i        || 0;
    rec_i        += d.rec_i        || 0;
    qtd_r        += d.qtd_r        || 0;
    rec_r        += d.rec_r        || 0;
  });

  const leads_total = leads_sdr + leads_closer;
  const inv         = monthData.inv; // investment is not per-fonte
  const ticket      = qtd_v > 0  ? +(rec_v / qtd_v).toFixed(0)            : 0;
  const roi         = inv   > 0  ? +((rec_v - inv) / inv).toFixed(1)       : 0;
  const lucro_bruto = +(rec_v - inv).toFixed(2);
  const cac         = qtd_v > 0  ? +(inv / qtd_v).toFixed(0)               : 0;
  const cpl         = leads_total > 0 ? +(inv / leads_total).toFixed(2)    : 0;

  // Filter fonte_sdr to only selected fontes
  const fonte_sdr = {};
  expandedFontes.forEach(f => {
    if (monthData.fonte_sdr?.[f] !== undefined) fonte_sdr[f] = monthData.fonte_sdr[f];
  });

  return {
    ...monthData,
    leads_sdr, leads_closer, leads_total,
    qtd_v, rec_v, qtd_i, rec_i, qtd_r, rec_r,
    ticket, roi, lucro_bruto, cac, cpl, inv,
    fonte_sdr,
  };
}


/**
 * Builds a single aggregated CURR-like object from the full period.
 *
 * - Lead/funnel metrics: from DATA (criado-indexed)
 * - Win/revenue metrics: from DATA_TERMINO (termino-indexed)
 */
function buildPeriodCurr(filtered, filteredT, label) {
  if (!filtered.length) return null;

  // ── Criado-indexed scalars ───────────────────────────────────────────────
  const leads_sdr    = sumKey(filtered, 'leads_sdr');
  const leads_closer = sumKey(filtered, 'leads_closer');
  const leads_total  = sumKey(filtered, 'leads_total');
  const reunioes     = sumKey(filtered, 'reunioes');
  const sdr_perdido  = sumKey(filtered, 'sdr_perdido');
  const sdr_ativo    = sumKey(filtered, 'sdr_ativo');
  // ganho/perdido/aberto from criado (funnel analysis — "por criação")
  const ganho_c  = sumKey(filtered, 'ganho');
  const perdido_c = sumKey(filtered, 'perdido');
  const aberto_c  = sumKey(filtered, 'aberto');
  const taxa_fech_c = (ganho_c + perdido_c) > 0
    ? +((ganho_c / (ganho_c + perdido_c)) * 100).toFixed(1) : 0;

  // ── Termino-indexed scalars ──────────────────────────────────────────────
  const src = filteredT.length ? filteredT : filtered;
  const qtd_v      = sumKey(src, 'qtd_v');
  const rec_v      = sumKey(src, 'rec_v');
  const qtd_i      = sumKey(src, 'qtd_i');
  const rec_i      = sumKey(src, 'rec_i');
  const qtd_r      = sumKey(src, 'qtd_r');
  const rec_r      = sumKey(src, 'rec_r');
  const inv        = sumKey(src, 'inv');
  const lucro_bruto = sumKey(src, 'lucro_bruto');

  // ── Derived ─────────────────────────────────────────────────────────────
  const ticket = qtd_v > 0 ? +(rec_v / qtd_v).toFixed(0) : 0;
  const roi    = inv   > 0 ? +((rec_v - inv) / inv).toFixed(2) : 0;
  const cac    = qtd_v > 0 ? +(inv / qtd_v).toFixed(0) : 0;
  const cpl    = leads_total > 0 ? +(inv / leads_total).toFixed(2) : 0;

  // ── Object fields ────────────────────────────────────────────────────────
  const fonte_sdr      = mergeKV(filtered, 'fonte_sdr');
  const mp_sdr         = mergeKV(filtered, 'mp_sdr');
  const mp_closer      = mergeKV(src, 'mp_closer');
  const inv_breakdown  = mergeKV(src, 'inv_breakdown');
  // closer_resp uses criado (funnel/pipeline view per closer)
  const closer_resp    = mergeNested(filtered, 'closer_resp', ['total', 'ganho', 'perdido', 'aberto']);
  const vendas_resp    = mergeNested(src, 'vendas_resp', ['qtd', 'receita']);
  const sdr_resp       = mergeNested(filtered, 'sdr_resp', ['total', 'conv_closer', 'perdido']);
  const sdr_mp_resp    = mergeNestedKV(filtered, 'sdr_mp_resp');
  const closer_mp_resp = mergeNestedKV(src, 'closer_mp_resp');
  const pp             = mergePP(src);

  // ── Licenças CS — agregado do período ──────────────────────────────────
  const lc_renovado    = sumKey(src, 'lc_renovado');
  const lc_cancelado   = sumKey(src, 'lc_cancelado');
  const lc_aberto      = sumKey(src, 'lc_aberto');
  const lc_total       = sumKey(src, 'lc_total');
  const lc_rec_renovado   = sumKey(src, 'lc_rec_renovado');
  const lc_rec_cancelado  = sumKey(src, 'lc_rec_cancelado');
  const lc_taxa_renovacao = (lc_renovado + lc_cancelado) > 0
    ? +((lc_renovado / (lc_renovado + lc_cancelado)) * 100).toFixed(1) : 0;
  const lc_resp        = mergeNested(src, 'lc_resp', ['total', 'renovado', 'cancelado', 'aberto', 'rec_renovado']);
  const lc_bitrix_uso  = mergeKV(src, 'lc_bitrix_uso');
  const lc_motivos_churn = mergeKV(src, 'lc_motivos_churn');

  return {
    ym: filtered[filtered.length - 1]?.ym ?? '',
    label,
    leads_sdr, leads_closer, leads_total, reunioes, sdr_perdido, sdr_ativo,
    ganho: ganho_c, perdido: perdido_c, aberto: aberto_c, taxa_fech: taxa_fech_c,
    qtd_v, rec_v, qtd_i, rec_i, qtd_r, rec_r, ticket,
    inv, lucro_bruto, roi, cac, cpl,
    fonte_sdr, mp_sdr, mp_closer, inv_breakdown,
    closer_resp, vendas_resp, sdr_resp, sdr_mp_resp, closer_mp_resp, pp,
    lc_total, lc_renovado, lc_cancelado, lc_aberto,
    lc_rec_renovado, lc_rec_cancelado, lc_taxa_renovacao,
    lc_resp, lc_bitrix_uso, lc_motivos_churn,
  };
}

// ── Hook ───────────────────────────────────────────────────────────────────

/**
 * criadoStart/End  → filters DATA (leads/funnel by Criado date)
 * terminoStart/End → filters DATA_TERMINO (wins/revenue by Data de fechamento)
 *
 * When period > 1 month (isRange):
 *   CURR = buildPeriodCurr (aggregated over full range)
 *   PREV = null (no delta comparison for multi-month view)
 *
 * When period = 1 month:
 *   CURR = blended single month (lead metrics from DATA, win metrics from DATA_TERMINO)
 *   PREV = blended previous month
 */
export function useDerivedData(criadoStart, criadoEnd, terminoStart, terminoEnd, fonteFilter = []) {
  const filtered = useMemo(
    () => DATA.filter(d => d.ym >= criadoStart && d.ym <= criadoEnd),
    [criadoStart, criadoEnd]
  );

  const filteredTermino = useMemo(
    () => DATA_TERMINO.filter(d => d.ym >= terminoStart && d.ym <= terminoEnd),
    [terminoStart, terminoEnd]
  );

  // Expand '__pagas__' once, memoized
  const expandedFontes = useMemo(() => expandFontes(fonteFilter), [fonteFilter]);

  // Apply fonte filter to each month record
  const filteredF = useMemo(
    () => expandedFontes.length
      ? filtered.map(d => applyFonteFilter(d, expandedFontes))
      : filtered,
    [filtered, expandedFontes]
  );
  const filteredTerminoF = useMemo(
    () => expandedFontes.length
      ? filteredTermino.map(d => applyFonteFilter(d, expandedFontes))
      : filteredTermino,
    [filteredTermino, expandedFontes]
  );

  // All fontes available in the selected period (for FonteSelector UI)
  const allFontes = useMemo(() => {
    const s = new Set();
    [...filtered, ...filteredTermino].forEach(d =>
      Object.keys(d.por_fonte || {}).forEach(f => { if (f && f !== 'Não identificado') s.add(f); })
    );
    return [...s].sort();
  }, [filtered, filteredTermino]);

  const isRange = filtered.length > 1;

  // ── Single-month blended CURR / PREV ────────────────────────────────────
  // Win/revenue fields that come from the termino period (single-month case)
  const WIN_FIELDS = [
    'qtd_v','rec_v','qtd_i','rec_i','qtd_r','rec_r','ticket',
    'roi','lucro_bruto','cac','cpl','inv','inv_breakdown',
    'mp_closer','closer_mp_resp','vendas_resp','pp',
    // Licenças CS — indexadas por [LC] Data de vencimento
    'lc_total','lc_renovado','lc_cancelado','lc_aberto',
    'lc_rec_renovado','lc_rec_cancelado','lc_taxa_renovacao',
    'lc_resp','lc_bitrix_uso','lc_motivos_churn',
  ];

  const blend = (base, t) => {
    if (!base) return null;
    const ov = {};
    WIN_FIELDS.forEach(f => { if (t?.[f] !== undefined) ov[f] = t[f]; });
    return { ...base, ...ov };
  };

  const CURR_C = filteredF[filteredF.length - 1] ?? null;
  const PREV_C = filteredF.length >= 2 ? filteredF[filteredF.length - 2] : null;
  const CURR_T = filteredTerminoF[filteredTerminoF.length - 1] ?? null;
  const PREV_T = filteredTerminoF.length >= 2 ? filteredTerminoF[filteredTerminoF.length - 2] : null;

  const CURR_SINGLE = useMemo(() => blend(CURR_C, CURR_T), [CURR_C, CURR_T]);
  const PREV_SINGLE = useMemo(() => blend(PREV_C, PREV_T), [PREV_C, PREV_T]);

  // ── Period aggregated CURR ───────────────────────────────────────────────
  const periodLabel = isRange
    ? `${filtered[0]?.label} → ${filtered[filtered.length - 1]?.label}`
    : (filtered[0]?.label ?? '');

  const CURR_PERIOD = useMemo(
    () => isRange ? buildPeriodCurr(filteredF, filteredTerminoF, periodLabel) : null,
    [filteredF, filteredTerminoF, isRange, periodLabel]
  );

  const CURR = isRange ? CURR_PERIOD : CURR_SINGLE;
  const PREV = isRange ? null : PREV_SINGLE;
  const N    = filteredF.length - 1;

  // ── Trend uses filtered with fonte applied ───────────────────────────────
  const trend = useMemo(() => buildTrend(filteredF), [filteredF]);

  // ── Fixed last-6-months trend — ignores date filters, still honors fonte ──
  const last6F = useMemo(
    () => expandedFontes.length
      ? LAST6_RAW.map(d => applyFonteFilter(d, expandedFontes))
      : LAST6_RAW,
    [expandedFontes]
  );
  const trend6 = useMemo(() => buildTrend(last6F), [last6F]);
  const N6 = last6F.length - 1;

  // ── Investimento x Faturamento x Lucro — últimos 6 meses, honors fonte filter ──
  const investRevenueVendas = useMemo(() => buildInvestRevenue(last6F, false), [last6F]);
  const investRevenueVendasInc = useMemo(() => buildInvestRevenue(last6F, true), [last6F]);

  // ── Mesmos 6 meses, ano anterior — mesmo tratamento de fonte ──────────────
  const last6PrevYearF = useMemo(
    () => expandedFontes.length
      ? LAST6_PREV_YEAR_RAW.map(d => applyFonteFilter(d, expandedFontes))
      : LAST6_PREV_YEAR_RAW,
    [expandedFontes]
  );
  const investRevenueVendasPrevYear = useMemo(
    () => buildInvestRevenue(last6PrevYearF, false), [last6PrevYearF]
  );
  const investRevenueVendasIncPrevYear = useMemo(
    () => buildInvestRevenue(last6PrevYearF, true), [last6PrevYearF]
  );

  const taxaGeralCurr = CURR && CURR.leads_total > 0
    ? +((CURR.qtd_v / CURR.leads_total) * 100).toFixed(1) : 0;
  const taxaGeralPrev = PREV && PREV.leads_total > 0
    ? +((PREV.qtd_v / PREV.leads_total) * 100).toFixed(1) : 0;

  const allMonths = DATA.map(d => d.ym);

  return {
    // filteredF/filteredTerminoF expose the fonte-filtered arrays to tabs
    filtered: filteredF, filteredTermino: filteredTerminoF,
    CURR, PREV, N, trend,
    // Fixed last-6-months series — ignores date filters (honors fonte filter)
    trend6, N6, last6: last6F,
    investRevenueVendas, investRevenueVendasInc,
    investRevenueVendasPrevYear, investRevenueVendasIncPrevYear,
    taxaGeralCurr, taxaGeralPrev, allMonths, isRange,
    allFontes,
  };
}
