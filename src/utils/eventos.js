import { DATA, EVENTOS } from '../data/data.js';

// Comentário de evento por mês (CLAUDE.md §16). A lista EVENTOS vem do extract.py;
// verba = linha `canal_investimento` de INVESTIMENTOS.xlsx no mês; leads = SDR + Closer da
// fonte do evento (as cópias no SDR já são contadas no mês do evento pelo extract.py).
// Usa o mês SEM filtro de fonte, para o comentário sempre mostrar o evento inteiro.
const BY_YM = new Map(DATA.map(d => [d.ym, d]));

/** Eventos cujo mês está em algum dos períodos selecionados (Criado em / Data de Término). */
export function getEventNotes(...periods) {
  const yms = new Set(periods.flat().map(d => d.ym));
  return (EVENTOS || [])
    .filter(e => yms.has(e.ym) && BY_YM.has(e.ym))
    .map(e => {
      const d     = BY_YM.get(e.ym);
      const pf    = d.por_fonte?.[e.fonte] || {};
      const valor = d.inv_breakdown?.[e.canal_investimento] ?? 0;
      return {
        ...e,
        label:       d.label,
        valor,
        invTotal:    d.inv,
        invPendente: !!d.inv_pendente,
        sharePct:    !d.inv_pendente && d.inv > 0 ? Math.round((valor / d.inv) * 100) : null,
        leads:       (pf.leads_sdr || 0) + (pf.leads_closer || 0),
        ativo:       pf.sdr_ativo   || 0,
        perdido:     pf.sdr_perdido || 0,
        // SDR em 'Reunião Realizada' (nem ativo nem perdido) — o lead avançou
        reuniao:     Math.max((pf.leads_sdr || 0) - (pf.sdr_ativo || 0) - (pf.sdr_perdido || 0), 0),
      };
    });
}
