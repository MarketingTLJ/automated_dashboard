import { ALERT_THR, ROI_TARGET } from '../constants/index.js';
import { fmt, dp } from './formatters.js';

/**
 * Generates diagnostic alerts comparing current vs previous month.
 * @param {object} curr - Current month data object
 * @param {object|null} prev - Previous month data object
 * @returns {Array<{t: string, icon: string, msg: string}>}
 */
export function generateAlerts(curr, prev) {
  if (!curr) return [];
  const a = [];

  const taxaGeralCurr = curr.leads_total > 0
    ? +((curr.qtd_v / curr.leads_total) * 100).toFixed(1)
    : 0;

  // ── Critical (red) ────────────────────────────────────────────────────────
  if (curr.roi < ALERT_THR.roiCritical)
    a.push({ t: 'red', icon: '🚨', msg: `ROI em ${curr.roi}x — abaixo da meta de ${ROI_TARGET}x. Investimento de ${fmt(curr.inv)} com retorno mais baixo do período.` });

  for (const [nm, d] of Object.entries(curr.vendas_resp || {})) {
    const share = curr.rec_v > 0 ? (d.receita / curr.rec_v) * 100 : 0;
    if (share > ALERT_THR.revenueConcentration)
      a.push({ t: 'red', icon: '🚨', msg: `Concentração: ${nm} responsável por ${share.toFixed(0)}% da receita (${fmt(d.receita)}).` });
  }

  if (taxaGeralCurr < ALERT_THR.taxaGeralCritical)
    a.push({ t: 'red', icon: '🚨', msg: `Taxa de Conversão Geral em ${taxaGeralCurr}% (${curr.qtd_v} vendas / ${curr.leads_total} leads) — mínimo do período.` });

  for (const [nm, d] of Object.entries(curr.closer_resp || {})) {
    if (d.total > ALERT_THR.pipelineAberto && d.ganho <= 1 && d.aberto > ALERT_THR.pipelineAberto)
      a.push({ t: 'red', icon: '🚨', msg: `${nm}: ${d.total} leads, ${d.ganho} ganho(s), ${d.aberto} em aberto — pipeline acumulado.` });
  }

  if (curr.pp && curr.pp.total > 0)
    a.push({ t: 'red', icon: '🚨', msg: `Propostas Perdidas: ${curr.pp.total} negócios · ${fmt(curr.pp.valor)} em receita perdida.` });

  // ── Warning (amber) ──────────────────────────────────────────────────────
  if (curr.cpl > ALERT_THR.cplHigh)
    a.push({ t: 'amber', icon: '⚠️', msg: `CPL de ${fmt(curr.cpl)} — mais alto do período (inv. ${fmt(curr.inv)} ÷ ${curr.leads_total} leads).` });

  if (prev) {
    const dr = dp(curr.reunioes, prev.reunioes);
    if (dr && parseFloat(dr) < -ALERT_THR.meetingsDrop)
      a.push({ t: 'amber', icon: '⚠️', msg: `Reuniões caíram ${Math.abs(dr)}% vs mês anterior (${curr.reunioes} vs ${prev.reunioes}).` });
  }

  // ── Positive (green) ─────────────────────────────────────────────────────
  if (prev) {
    const dr = dp(curr.reunioes, prev.reunioes);
    if (dr && parseFloat(dr) > ALERT_THR.meetingsRise)
      a.push({ t: 'green', icon: '✅', msg: `Reuniões subiram ${dr}% — ${curr.reunioes} vs ${prev.reunioes}. Funil aquecendo.` });

    const dt = dp(curr.ticket, prev.ticket);
    if (dt && parseFloat(dt) > 0)
      a.push({ t: 'green', icon: '✅', msg: `Ticket médio ${fmt(curr.ticket)} — crescimento de ${dt}% vs mês anterior.` });

    const di = dp(curr.rec_i, prev.rec_i);
    if (di && parseFloat(di) > ALERT_THR.incrementsRise)
      a.push({ t: 'green', icon: '✅', msg: `Incrementos cresceram ${di}% — ${fmt(curr.rec_i)} (${curr.qtd_i} registros).` });
  }

  if (curr.roi >= ROI_TARGET)
    a.push({ t: 'green', icon: '✅', msg: `ROI de ${curr.roi}x — acima da meta de ${ROI_TARGET}x.` });

  return a.slice(0, 6);
}
