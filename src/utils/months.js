import { DATA } from '../data/data.js';

// Meses disponíveis e mês em andamento (CLAUDE.md §15.7).
// O dashboard abre no ÚLTIMO MÊS FECHADO; o mês corrente aparece como "parcial".
export const ALL_YMS     = DATA.map(d => d.ym);
export const CLOSED_YMS  = DATA.filter(d => !d.parcial).map(d => d.ym);
export const LAST_CLOSED = CLOSED_YMS.at(-1) ?? ALL_YMS.at(-1);
export const PARTIAL_YM  = DATA.find(d => d.parcial)?.ym ?? null;

export const isPartial = ym => ym === PARTIAL_YM;

/** true se algum mês do conjunto ainda não tem investimento lançado na planilha */
export const anyInvPendente = (...arrs) => arrs.some(arr => (arr || []).some(d => d?.inv_pendente));
