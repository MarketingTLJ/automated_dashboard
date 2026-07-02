import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { SectionHeader } from '../components/ui/SectionHeader.jsx';
import { KpiCard } from '../components/ui/KpiCard.jsx';
import { RevenueStackedBar } from '../components/charts/RevenueStackedBar.jsx';
import { ChartTooltip } from '../components/ui/ChartTooltip.jsx';
import { fmt, fmtK } from '../utils/formatters.js';
import { COLORS, CHART_OPACITY } from '../constants/index.js';

export function Tab1_Receita({ CURR, PREV, trend, trend6, N6, filtered, isRange }) {
  if (!CURR) return null;
  const totalRec  = CURR.rec_v + CURR.rec_i + CURR.rec_r;
  const prevTotal = PREV ? PREV.rec_v + PREV.rec_i + PREV.rec_r : undefined;
  const pctV = totalRec > 0 ? ((CURR.rec_v / totalRec) * 100).toFixed(0) : 0;
  const pctI = totalRec > 0 ? ((CURR.rec_i / totalRec) * 100).toFixed(0) : 0;
  const pctR = totalRec > 0 ? ((CURR.rec_r / totalRec) * 100).toFixed(0) : 0;

  // Period totals
  const sumV = trend.reduce((s, d) => s + d.vendas, 0);
  const sumI = trend.reduce((s, d) => s + d.inc, 0);
  const sumR = trend.reduce((s, d) => s + d.ren, 0);

  return (
    <div>
      <SectionHeader number={1} title="Análise de Receita"
        subtitle={isRange ? `Novas Vendas, Incrementos e Renovações · ${CURR.label}` : `Novas Vendas, Incrementos e Renovações · ${CURR.label} vs período`} />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
        <KpiCard title="Receita Total" value={fmt(totalRec)}
          sub={isRange ? 'Total período' : CURR.label}
          curr={totalRec} prev={prevTotal} color={COLORS.vendas} icon="📊" />
        <KpiCard title="Novas Vendas" value={fmt(CURR.rec_v)} sub={`${CURR.qtd_v} contratos`}
          curr={CURR.rec_v} prev={PREV?.rec_v} color={COLORS.vendas} icon="💰" />
        <KpiCard title="Incrementos" value={fmt(CURR.rec_i)} sub={`${CURR.qtd_i} registros`}
          curr={CURR.rec_i} prev={PREV?.rec_i} color={COLORS.incrementos} icon="⬆️" />
        <KpiCard title="Renovações" value={fmt(CURR.rec_r)} sub={`${CURR.qtd_r} renovações`}
          curr={CURR.rec_r} prev={PREV?.rec_r} color={COLORS.renovacoes} icon="🔄" />
      </div>

      {/* Ticket Médio */}
      <div className="glass-card rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold">Ticket Médio — Novas Vendas</p>
          <p className="text-green-400 text-sm font-bold">{fmt(CURR.ticket)}</p>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={trend6}>
            <defs>
              <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.vendas} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.vendas} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtK} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip currency />} />
            <Area type="monotone" dataKey="ticket" name="Ticket Médio" stroke={COLORS.vendas}
              fill="url(#tg)" strokeWidth={2} dot={{ fill: COLORS.vendas, r: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Faturamento — Total vs Novas Vendas vs Incrementos */}
      <div className="glass-card rounded-2xl p-5 mb-6">
        <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-4">
          Evolução de Faturamento — Total, Novas Vendas e Incrementos
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={trend6}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtK} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip currency />} />
            <Legend wrapperStyle={{ color: '#374151', fontSize: '11px' }} />
            <Line type="monotone" dataKey="total_rec" name="Faturamento Total" stroke={COLORS.brandBlue}
              strokeWidth={2} dot={{ fill: COLORS.brandBlue, r: 3 }} />
            <Line type="monotone" dataKey="vendas" name="Novas Vendas" stroke={COLORS.vendas}
              strokeWidth={2} dot={{ fill: COLORS.vendas, r: 3 }} />
            <Line type="monotone" dataKey="inc" name="Incrementos" stroke={COLORS.incrementos}
              strokeWidth={2} dot={{ fill: COLORS.incrementos, r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Mix + Evolução */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {/* Revenue mix */}
        <div className="glass-card rounded-2xl p-5">
          <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-4">Mix de Receita — {isRange ? 'Período' : CURR.label}</p>
          <div className="space-y-3">
            {[
              { label: 'Novas Vendas', val: CURR.rec_v, pct: pctV, color: COLORS.vendas },
              { label: 'Incrementos',  val: CURR.rec_i, pct: pctI, color: COLORS.incrementos },
              { label: 'Renovações',   val: CURR.rec_r, pct: pctR, color: COLORS.renovacoes },
            ].map(r => (
              <div key={r.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">{r.label}</span>
                  <span className="font-bold" style={{ color: r.color }}>{r.pct}% · {fmtK(r.val)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full" style={{ width: `${r.pct}%`, background: r.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Total período ({trend.length}m)</span>
              <span className="text-white font-bold">{fmtK(sumV + sumI + sumR)}</span>
            </div>
          </div>
        </div>

        {/* Incrementos bar */}
        <div className="glass-card rounded-2xl p-5 col-span-1 md:col-span-2">
          <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-1">Incrementos por Mês</p>
          <p className="text-emerald-400 text-xs font-bold mb-4">{isRange ? 'Período' : CURR.label}: {fmt(CURR.rec_i)} · {CURR.qtd_i} registros</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={trend6}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip currency />} />
              <Bar dataKey="inc" name="Incrementos" radius={[4, 4, 0, 0]}>
                {trend6.map((_, i) => <Cell key={i} fill={COLORS.incrementos} opacity={i === N6 ? CHART_OPACITY.active : CHART_OPACITY.past} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Full stacked */}
      <div className="glass-card rounded-2xl p-5">
        <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-4">Evolução de Receita — Últimos 6 Meses</p>
        <RevenueStackedBar data={trend6} N={N6} height={280} />
      </div>
    </div>
  );
}
