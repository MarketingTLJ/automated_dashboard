import { SectionHeader } from '../components/ui/SectionHeader.jsx';
import { FunnelBars } from '../components/charts/FunnelBars.jsx';
import { WinLossBar } from '../components/charts/WinLossBar.jsx';
import { DeltaBadge } from '../components/ui/DeltaBadge.jsx';
import { scl, sclCls, pct } from '../utils/formatters.js';
import { THR } from '../constants/index.js';

const STAGES = [
  { key: 'leads', label: '1. Leads Gerados',     color: '#3374B5', icon: '📥', note: 'SDR + Closer criados' },
  { key: 'reunioes', label: '2. Reuniões',        color: '#2563eb', icon: '📅', note: '= Leads criados no Closer' },
  { key: 'pipeline', label: '3. Pipeline Closer', color: '#0e7490', icon: '💼', note: 'Em negociação' },
  { key: 'vendas', label: '4. Vendas Fechadas',   color: '#22c55e', icon: '✅', note: 'Contratos assinados' },
];

export function Tab2_FunilComercial({ CURR, PREV, trend6, N6, filtered, isRange }) {
  if (!CURR) return null;

  const taxaGeral = CURR.leads_total > 0 ? +((CURR.qtd_v / CURR.leads_total) * 100).toFixed(1) : 0;
  const taxaRG    = CURR.reunioes > 0   ? +((CURR.ganho / CURR.reunioes) * 100).toFixed(1)      : 0;

  // SDR → Closer conversion (how many SDR leads moved to Closer)
  const taxaSdrCloser = CURR.leads_sdr > 0
    ? +((CURR.leads_closer / CURR.leads_sdr) * 100).toFixed(1)
    : 0;

  const stageValues = {
    leads:    CURR.leads_total,
    reunioes: CURR.reunioes,
    pipeline: CURR.ganho + CURR.perdido + CURR.aberto,
    vendas:   CURR.qtd_v,
  };
  const prevValues = PREV ? {
    leads:    PREV.leads_total,
    reunioes: PREV.reunioes,
    pipeline: PREV.ganho + PREV.perdido + PREV.aberto,
    vendas:   PREV.qtd_v,
  } : null;

  return (
    <div>
      <SectionHeader number={2} title="Funil Comercial"
        subtitle={`Leads → Reuniões → Pipeline → Vendas · ${isRange ? 'Totais do Período' : CURR.label}`} />

      {/* Funnel stages */}
      <div className="glass-card rounded-2xl p-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {STAGES.map(s => {
            const curr = stageValues[s.key];
            const prev = prevValues?.[s.key];
            return (
              <div key={s.key} className="rounded-xl border border-gray-100 bg-white/60 p-4" style={{ background: `${s.color}08` }}>
                <span className="text-2xl">{s.icon}</span>
                <p className="text-gray-600 text-xs mt-2 mb-1 leading-tight">{s.label}</p>
                <p className="text-3xl font-black mb-1" style={{ color: s.color }}>{curr}</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {prev !== undefined && <span className="text-gray-600 text-xs">Ant: {prev}</span>}
                  {prev !== undefined && <DeltaBadge curr={curr} prev={prev} />}
                </div>
                <p className="text-gray-600 text-xs mt-1">{s.note}</p>
              </div>
            );
          })}
        </div>

        {/* SDR breakdown */}
        <div className="grid grid-cols-2 gap-3 mb-6 p-3 bg-gray-50 rounded-xl">
          <div>
            <p className="text-gray-600 text-xs mb-1">Breakdown Leads</p>
            <p className="text-gray-600 text-sm">
              <span className="text-brand-blue-light font-bold">{CURR.leads_sdr}</span> SDR
              {' + '}
              <span className="font-bold" style={{ color: '#2563eb' }}>{CURR.leads_closer}</span> Closer
            </p>
          </div>
          <div>
            <p className="text-gray-600 text-xs mb-1">SDR → Closer</p>
            <p className="text-gray-600 text-sm">
              Taxa de avanço:{' '}
              <span className="font-bold" style={{ color: scl(taxaSdrCloser, THR.taxaConvSdr) }}>
                {taxaSdrCloser}%
              </span>
            </p>
          </div>
        </div>

        {/* Conversion rates */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { lb: 'Conv. Geral',          v: taxaGeral,       thr: THR.taxaConvGeral  },
            { lb: 'SDR → Closer',         v: taxaSdrCloser,   thr: THR.taxaConvSdr    },
            { lb: 'Taxa Fech. Closer',    v: CURR.taxa_fech,  thr: THR.taxaFechCloser },
          ].map(c => (
            <div key={c.lb} className="bg-gray-50 rounded-xl p-4">
              <p className="text-gray-600 text-xs mb-2">{c.lb}</p>
              <p className="text-2xl font-black" style={{ color: scl(c.v, c.thr) }}>{c.v}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-4">Leads e Reuniões — Período</p>
          <FunnelBars data={trend6} N={N6} />
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-4">Ganhos vs Perdidos — Closer</p>
          <WinLossBar data={trend6} N={N6} />
        </div>
      </div>
    </div>
  );
}
