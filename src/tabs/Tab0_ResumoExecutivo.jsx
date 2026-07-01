import { DeltaBadge } from '../components/ui/DeltaBadge.jsx';
import { AlertBanner } from '../components/ui/AlertBanner.jsx';
import { RevenueStackedBar } from '../components/charts/RevenueStackedBar.jsx';
import { ConversionRateBar } from '../components/charts/ConversionRateBar.jsx';
import { RevenueInvestmentTrend } from '../components/charts/RevenueInvestmentTrend.jsx';
import { fmt, scl } from '../utils/formatters.js';
import { generateAlerts } from '../utils/alertEngine.js';
import { THR } from '../constants/index.js';

export function Tab0_ResumoExecutivo({
  CURR, PREV, trend6, N6, investRevenueVendas, investRevenueVendasInc,
  filtered, filteredTermino, isRange,
  periodStart, periodEnd, taxaGeralCurr, taxaGeralPrev,
}) {
  if (!CURR) return null;

  // ── Period aggregates (decoupled: leads from criado filter, sales from termino filter) ──
  const ftList = filteredTermino?.length ? filteredTermino : filtered;

  const periodLeads = filtered.reduce((s, d) => s + d.leads_total, 0);
  const periodSales = ftList.reduce((s, d) => s + d.qtd_v, 0);
  const periodRecV  = ftList.reduce((s, d) => s + d.rec_v, 0);
  const periodRec   = ftList.reduce((s, d) => s + (d.rec_v + d.rec_i + d.rec_r), 0);

  const taxaGeralPer = periodLeads > 0
    ? +((periodSales / periodLeads) * 100).toFixed(1) : 0;
  const ticketPer = periodSales > 0 ? +(periodRecV / periodSales).toFixed(0) : 0;

  const alerts    = generateAlerts(CURR, PREV);
  const prevLabel = PREV?.label ?? '—';

  // ── KPI grid adapts to mode ──────────────────────────────────────────────────
  const kpis = isRange
    ? [
        { lb: 'Total Leads',        v: periodLeads,            num: true },
        { lb: 'Contratos',          v: periodSales,            num: true },
        {
          lb: 'Taxa Conv. Geral',   v: taxaGeralPer + '%',
          note: 'Vendas / Total Leads', warn: taxaGeralPer < 3,
        },
        {
          lb: 'Taxa Fech. Closer',  v: CURR.taxa_fech + '%',
          note: 'Ganhos / Decididos',
          clr: scl(CURR.taxa_fech, THR.taxaFechCloser),
        },
        { lb: 'Ticket Médio', v: fmt(ticketPer), hi: true },
      ]
    : [
        { lb: 'Total Leads',        v: CURR.leads_total,   c: CURR.leads_total,   p: PREV?.leads_total },
        { lb: 'Contratos',          v: CURR.qtd_v,         c: CURR.qtd_v,         p: PREV?.qtd_v },
        {
          lb: 'Taxa Conv. Geral',   v: taxaGeralCurr + '%',
          c: taxaGeralCurr, p: taxaGeralPrev,
          note: 'Vendas / Total Leads', warn: taxaGeralCurr < 3,
        },
        {
          lb: 'Taxa Fech. Closer',  v: CURR.taxa_fech + '%',
          c: CURR.taxa_fech, p: PREV?.taxa_fech,
          note: 'Ganhos / Decididos',
          clr: scl(CURR.taxa_fech, THR.taxaFechCloser),
        },
        { lb: 'Ticket Médio', v: fmt(CURR.ticket), c: CURR.ticket, p: PREV?.ticket, hi: true },
      ];

  return (
    <div>
      {/* Hero */}
      <div
        className="relative rounded-3xl overflow-hidden mb-8 shadow-lg"
        style={{ background: 'linear-gradient(135deg,#0d1e3d 0%,#152a4a 50%,#1a3060 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 50%,#3374B5 0%,transparent 50%),' +
              'radial-gradient(circle at 80% 20%,#E31E24 0%,transparent 40%)',
          }}
        />
        <div className="relative p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
            <div>
              <p className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-1">
                Grupo TLJ · Análise Comercial
              </p>

              {isRange ? (
                <>
                  <h1 className="text-4xl font-black text-white mb-1">
                    {filtered[0]?.label.split('/')[0]}
                    <span className="text-blue-300/60 text-2xl font-bold mx-2">→</span>
                    {CURR.ym ? filtered[filtered.length - 1]?.label.split('/')[0] : CURR.label.split('/')[0]}
                    <span className="text-brand-red">/{filtered[filtered.length - 1]?.label.split('/')[1]}</span>
                  </h1>
                  <p className="text-blue-200/60 text-sm">
                    {filtered.length} meses · totais do período
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-5xl font-black text-white mb-1">
                    {CURR.label.split('/')[0]}
                    <span className="text-brand-red">/{CURR.label.split('/')[1]}</span>
                  </h1>
                  <p className="text-blue-200/60 text-sm">
                    {filtered[0]?.label} → {CURR.label} · {filtered.length} {filtered.length === 1 ? 'mês' : 'meses'}
                  </p>
                </>
              )}
            </div>

            <div className="text-right">
              <p className="text-blue-200/70 text-xs uppercase tracking-wider mb-1">Receita Novas Vendas</p>
              {isRange ? (
                <>
                  <p className="text-4xl font-black text-white">{fmt(periodRecV)}</p>
                  <p className="text-blue-200/50 text-xs mt-1">Total período</p>
                </>
              ) : (
                <>
                  <p className="text-4xl font-black text-white">{fmt(CURR.rec_v)}</p>
                  <div className="flex items-center gap-2 justify-end mt-1">
                    {PREV && <DeltaBadge curr={CURR.rec_v} prev={PREV.rec_v} />}
                    <span className="text-blue-200/50 text-xs">vs {prevLabel}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {kpis.map((k, i) => (
              <div key={i} className="bg-white/8 border border-white/12 rounded-xl p-4 backdrop-blur-sm">
                <p className="text-blue-200/70 text-xs uppercase tracking-wider mb-1">{k.lb}</p>
                {k.note && <p className="text-blue-200/40 text-xs mb-1">{k.note}</p>}
                <p
                  className={`text-2xl font-black ${k.warn ? 'text-red-400' : k.hi ? 'text-green-400' : 'text-white'}`}
                  style={k.clr ? { color: k.clr } : {}}
                >
                  {k.v}
                </p>
                {!isRange && k.c !== undefined && k.p !== undefined && (
                  <DeltaBadge curr={k.c} prev={k.p} />
                )}
                {isRange && k.num && (
                  <p className="text-blue-200/40 text-xs mt-1">total período</p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 rounded-xl bg-white/8 border border-white/10">
            <p className="text-blue-200/60 text-xs">
              ℹ️ <strong className="text-white">Taxa Conv. Geral</strong> = Vendas fechadas ÷ Total Leads gerados.&nbsp;|&nbsp;
              <strong className="text-white">Taxa Fech. Closer</strong> = Ganhos ÷ (Ganhos + Perdidos) — eficiência operacional.
            </p>
          </div>
        </div>
      </div>

      {/* Period summary cards — shown only in range mode */}
      {isRange && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
          {[
            { lb: 'Leads criados (período)',   v: periodLeads,     color: '#3374B5', sub: 'Filtro: Criado em' },
            { lb: 'Contratos fechados',        v: periodSales,     color: '#22c55e', sub: 'Filtro: Data de Término' },
            { lb: 'Receita Novas Vendas',      v: fmt(periodRecV), color: '#3374B5', sub: 'Filtro: Data de Término' },
            { lb: 'Receita Total (Vendas + Incrementos)',             v: fmt(periodRec),  color: '#3374B5', sub: 'Filtro: Data de Término' },
          ].map((s, i) => (
            <div key={i} className="glass-card rounded-xl p-4">
              <p className="text-gray-600 text-xs mb-0.5">{s.lb}</p>
              <p className="text-xl font-black" style={{ color: s.color }}>{s.v}</p>
              <p className="text-gray-600 text-xs mt-1">{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mb-8">
          <h3 className="text-gray-700 text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-brand-red rounded-full" />
            Diagnóstico Automático
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {alerts.map((a, i) => (
              <AlertBanner key={i} type={a.t} icon={a.icon} message={a.msg} />
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-4">
            Receita — Vendas + Incrementos + Renovações
          </p>
          <RevenueStackedBar data={trend6} N={N6} height={200} />
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-1">
            Taxa de Conversão Geral (%)
          </p>
          <p className="text-gray-600 text-xs mb-4">Vendas ÷ Total Leads gerados no mês</p>
          <ConversionRateBar data={trend6} N={N6} height={180} />
        </div>
      </div>

      {/* Investimento x Faturamento x Lucro — últimos 6 meses, todas as fontes */}
      <div className="grid grid-cols-1 gap-5 mt-5">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-4">
            Novas Vendas — Todas as Fontes · Últimos 6 Meses
          </p>
          <RevenueInvestmentTrend data={investRevenueVendas} />
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-4">
            Novas Vendas + Incrementos — Todas as Fontes · Últimos 6 Meses
          </p>
          <RevenueInvestmentTrend data={investRevenueVendasInc} />
        </div>
      </div>
    </div>
  );
}
