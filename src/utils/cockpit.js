import { COCKPIT, DATA, EVENTOS } from '../data/data.js';
import {
  COCKPIT_ETAPAS_AVANCADAS, COCKPIT_ORIGEM_CONTA, COCKPIT_ORIGENS_WHATSAPP, COLORS,
} from '../constants/index.js';
import { getEventNotes } from './eventos.js';
import { monthLabel } from './months.js';

// Aba Cockpit AI (CLAUDE.md §20). Toda a agregação fica aqui; a aba só desenha.
// Cada lead de COCKPIT.leads: d=criado, e=etapa, o=origem, r=responsável, v=mensalidade,
// c=criou conta gratuita, s=segmento, mira=interesse na IA Mira, u=UTMs (só cadastros casados com o Bitrix).

export const COCKPIT_OK = !!COCKPIT?.leads;

const GANHO   = new Set(COCKPIT?.etapa_ganho ?? []);
const PERDIDO = new Set(COCKPIT?.etapa_perdido ?? []);
const AVANC   = new Set(COCKPIT_ETAPAS_AVANCADAS);

/** novo · andamento · avancado · ganho · perdido */
export function grupoEtapa(e) {
  if (GANHO.has(e))   return 'ganho';
  if (PERDIDO.has(e)) return 'perdido';
  if (AVANC.has(e))   return 'avancado';
  if (e === COCKPIT?.etapa_novo) return 'novo';
  return 'andamento';
}

export const COR_GRUPO = {
  novo: COLORS.ckNovo, andamento: COLORS.ckAndamento, avancado: COLORS.ckAvancado,
  ganho: COLORS.ckGanho, perdido: COLORS.ckPerdido,
};

export function grupoOrigem(o) {
  if (o === COCKPIT_ORIGEM_CONTA) return 'conta';
  if (COCKPIT_ORIGENS_WHATSAPP.includes(o)) return 'whatsapp';
  return 'outras';
}

const pctN = (a, b) => (b > 0 ? (a / b) * 100 : null);

/** Contagens de um conjunto de leads */
export function contar(leads) {
  const r = { total: leads.length, contas: 0, novo: 0, andamento: 0, avancado: 0, ganho: 0, perdido: 0,
              mrr: 0, mrrNegociacao: 0, mira: 0 };
  for (const l of leads) {
    const g = grupoEtapa(l.e);
    r[g] += 1;
    if (l.c) r.contas += 1;
    if (l.mira) r.mira += 1;
    if (g === 'ganho') r.mrr += l.v || 0;
    if (g === 'avancado') r.mrrNegociacao += l.v || 0;
  }
  r.emAberto   = r.novo + r.andamento + r.avancado;
  r.taxaVenda  = pctN(r.ganho, r.total);
  r.taxaAvanco = pctN(r.avancado + r.ganho, r.total);   // chegou a demo/proposta ou fechou
  r.taxaPerda  = pctN(r.perdido, r.total);
  return r;
}

/** Agrupa por uma chave (função) e devolve linhas ordenadas por volume */
export function agrupar(leads, chave, vazio = 'Não informado') {
  const m = new Map();
  for (const l of leads) {
    const k = chave(l) ?? vazio;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(l);
  }
  return [...m.entries()]
    .map(([nome, arr]) => ({ nome, ...contar(arr) }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
}

/** Leads por dia, separados pela origem — todos os dias entre o 1º e o último lead */
export function porDia(leads) {
  if (!leads.length) return [];
  const cont = new Map();
  for (const l of leads) {
    const c = cont.get(l.d) ?? { conta: 0, whatsapp: 0, outras: 0 };
    c[grupoOrigem(l.o)] += 1;
    cont.set(l.d, c);
  }
  const out = [];
  const fim = new Date(`${leads.at(-1).d}T12:00:00`);
  for (let d = new Date(`${leads[0].d}T12:00:00`); d <= fim; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const c = cont.get(iso) ?? { conta: 0, whatsapp: 0, outras: 0 };
    out.push({ dia: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`, ...c, total: c.conta + c.whatsapp + c.outras });
  }
  return out;
}

/** Distribuição pela etapa atual, na ordem do Kanban do Cockpit */
export function porEtapa(leads) {
  return (COCKPIT?.etapas ?? []).map(e => {
    const arr = leads.filter(l => l.e === e);
    return { etapa: e, grupo: grupoEtapa(e), n: arr.length, valor: arr.reduce((s, l) => s + (l.v || 0), 0) };
  });
}

/**
 * Tudo que a aba precisa para o período do filtro "Criado em".
 * Investimento = linha do Cockpit em INVESTIMENTOS.xlsx, só nos meses desde COCKPIT.desde.
 * `invPendente` = algum mês do período (desde o início do Cockpit) sem verba lançada.
 */
export function cockpitPeriodo(startYm, endYm) {
  if (!COCKPIT_OK) return null;
  const meses = DATA.filter(d => d.ym >= startYm && d.ym <= endYm && d.ym >= COCKPIT.desde);
  const leads = COCKPIT.leads.filter(l => { const ym = l.d.slice(0, 7); return ym >= startYm && ym <= endYm; });
  const inv = meses.reduce((s, d) => s + (COCKPIT.inv[d.ym] || 0), 0);
  const invPendente = meses.some(d => !(COCKPIT.inv[d.ym] > 0));
  const k = contar(leads);
  const label = meses.length === 0 ? null
    : meses.length === 1 ? monthLabel(meses[0])
    : `${meses[0].label} → ${monthLabel(meses.at(-1))}`;
  return {
    label, meses, leads, inv, invPendente, ...k,
    cpl:        !invPendente && k.total  > 0 ? inv / k.total  : null,
    custoConta: !invPendente && k.contas > 0 ? inv / k.contas : null,
    cac:        !invPendente && k.ganho  > 0 ? inv / k.ganho  : null,
    // Valor do negócio no Cockpit = MENSALIDADE (decisão do usuário, 2026-11-03)
    roi1:       !invPendente && inv > 0 ? (k.mrr - inv) / inv : null,   // ROI do 1º mês de mensalidade
    payback:    !invPendente && k.mrr > 0 ? inv / k.mrr : null,         // meses de mensalidade para pagar a verba
  };
}

/** Meses com dados do Cockpit (para a mensagem de período vazio) */
export const COCKPIT_DESDE_LABEL = DATA.find(d => d.ym === COCKPIT?.desde)?.label ?? COCKPIT?.desde;

/** Verba do Cockpit que NÃO está no Total Investido do Grupo, nos meses dos períodos (aba Investimentos) */
export function verbaCockpitForaDoGrupo(...periods) {
  if (!COCKPIT_OK) return [];
  const yms = [...new Set(periods.flat().map(d => d.ym))].sort();
  return yms.filter(ym => COCKPIT.inv[ym] > 0)
    .map(ym => ({ ym, label: DATA.find(d => d.ym === ym)?.label ?? ym, valor: COCKPIT.inv[ym] }));
}

/** Eventos cuja verba saiu da linha do Cockpit (ex.: Live de lançamento, Set/26) — bloco à parte */
export function eventosCockpit() {
  const evs = (EVENTOS || []).filter(e => e.canal_investimento === COCKPIT?.canal);
  return getEventNotes(evs.map(e => ({ ym: e.ym }))).filter(n => n.canal_investimento === COCKPIT?.canal);
}
