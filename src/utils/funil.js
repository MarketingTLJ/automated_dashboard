import { COLORS } from '../constants/index.js';

// Funil de conversão das abas Funil Comercial e Análise SDR (decisão do usuário 2026-10-19).
// Tudo por safra de CRIAÇÃO (filtro "Criado em"): vendas = negócios criados no período que
// viraram venda, não as vendas por Data de Fechamento. `funil` vem do extract.py (histórico
// de etapas do Bitrix) — é null quando os dados vieram das planilhas (--source excel).

export const FUNIL_KEYS = [
  'agendadas', 'sdr_entrada', 'sdr_efetivos', 'sdr_agendadas', 'sdr_realizadas', 'sdr_vendas', 'sdr_aberto',
];

// Soma o funil de vários meses (null se algum mês não tiver o funil)
export function sumFunil(arr) {
  if (!arr.length || arr.some(d => !d.funil)) return null;
  const r = {};
  FUNIL_KEYS.forEach(k => { r[k] = arr.reduce((s, d) => s + (d.funil[k] || 0), 0); });
  return r;
}

// Agrega meses (já filtrados por fonte) no formato que as etapas usam
export function aggFunil(arr, label) {
  const sum = k => arr.reduce((s, d) => s + (d[k] || 0), 0);
  return {
    label, meses: arr.length,
    leads_total: sum('leads_total'), leads_efetivos: sum('leads_efetivos'),
    leads_closer: sum('leads_closer'), ganho: sum('ganho'), aberto: sum('aberto'),
    funil: sumFunil(arr),
    closer_diretos: arr.flatMap(d => d.closer_diretos || []),
  };
}

export function etapasComercial(rec) {
  if (!rec?.funil) return null;
  return [
    { key: 'leads',  label: 'Leads gerados',      value: rec.leads_total,      color: COLORS.leads,         note: 'SDR + Closer criados' },
    { key: 'efet',   label: 'Leads efetivos',     value: rec.leads_efetivos,   color: COLORS.leadsEfetivos, note: 'Sem duplicados, testes e sem contato' },
    { key: 'agend',  label: 'Reuniões agendadas', value: rec.funil.agendadas,  color: COLORS.reunioes,      note: 'Agendadas no SDR (inclui no-show) + entradas diretas no Closer' },
    { key: 'opp',    label: 'Oportunidades',      value: rec.leads_closer,     color: COLORS.oportunidades, note: 'Negócios no Closer (reunião realizada)' },
    { key: 'vendas', label: 'Vendas',             value: rec.ganho,            color: COLORS.ganho,         note: 'Leads do período que viraram venda', aberto: rec.aberto },
  ];
}

export function etapasSdr(rec) {
  if (!rec?.funil) return null;
  const f = rec.funil;
  return [
    { key: 'entrada', label: 'Leads do SDR',        value: f.sdr_entrada,    color: COLORS.leads,         note: 'Entraram pelo SDR (inclui os que já foram ao Closer)' },
    { key: 'efet',    label: 'Leads efetivos SDR',  value: f.sdr_efetivos,   color: COLORS.leadsEfetivos, note: 'Sem duplicados, testes e sem contato' },
    { key: 'agend',   label: 'Reuniões agendadas',  value: f.sdr_agendadas,  color: COLORS.reunioes,      note: 'Chegaram a "Reunião agendada" (inclui no-show)' },
    { key: 'real',    label: 'Reuniões realizadas', value: f.sdr_realizadas, color: COLORS.oportunidades, note: 'Passadas ao Closer' },
    { key: 'vendas',  label: 'Vendas',              value: f.sdr_vendas,     color: COLORS.ganho,         note: 'Leads do SDR que viraram venda', aberto: f.sdr_aberto },
  ];
}

// Negócios criados DIRETO no Closer (sem passar pelo SDR) — é o que separa o Funil
// Comercial do Funil SDR: entram em Leads/Efetivos/Agendadas/Oportunidades/Vendas do
// Comercial e ficam fora do SDR.
export function diretosCloser(rec) {
  if (!rec?.funil) return null;
  return {
    total:  Math.max(rec.leads_total - rec.funil.sdr_entrada, 0),
    vendas: Math.max(rec.ganho - rec.funil.sdr_vendas, 0),
    aberto: Math.max(rec.aberto - rec.funil.sdr_aberto, 0),
  };
}

// Conversão de uma etapa para a seguinte (%), ou null sem base
export const convPct = (de, para) => (de > 0 ? (para / de) * 100 : null);
