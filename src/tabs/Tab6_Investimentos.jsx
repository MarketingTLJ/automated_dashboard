import { SectionHeader } from '../components/ui/SectionHeader.jsx';
import { KpiCard } from '../components/ui/KpiCard.jsx';
import { RoiCplComposed } from '../components/charts/RoiCplComposed.jsx';
import { fmt, fmtK, sclCls } from '../utils/formatters.js';
import { COLORS } from '../constants/index.js';

export function Tab6_Investimentos({ CURR, PREV, trend, N, filtered, isRange }) {
  if (!CURR) return null;

  return (
    <div>
      <SectionHeader number={6} title="Investimentos & ROI"
        subtitle={isRange ? `Eficiência de mídia · ${CURR.label}` : `Eficiência de mídia · ${CURR.label} vs período`} />

      {/* KPIs — row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <KpiCard title="Total Investido" value={fmt(CURR.inv)} sub="Google + Meta + WhatsApp"
          curr={CURR.inv} prev={PREV?.inv} color={COLORS.brandBlueLight} icon="📢" inv />
        <KpiCard title="ROI Líquido" value={`${CURR.roi}x`} sub="Lucro Bruto ÷ Investimento"
          curr={CURR.roi} prev={PREV?.roi}
          color={CURR.roi < 8 ? COLORS.brandRed : CURR.roi >= 15 ? COLORS.ganho : '#f97316'} icon="📈" />
        <KpiCard title="Lucro Bruto" value={fmt(CURR.lucro_bruto ?? (CURR.rec_v - CURR.inv))}
          sub={`Vendas - Investimento`}
          curr={CURR.lucro_bruto ?? (CURR.rec_v - CURR.inv)} prev={PREV ? (PREV.lucro_bruto ?? (PREV.rec_v - PREV.inv)) : undefined}
          color="#22c55e" icon="💵" />
        <KpiCard title="CAC" value={fmt(CURR.cac ?? 0)} sub={`${CURR.qtd_v} contratos fechados`}
          curr={CURR.cac ?? 0} prev={PREV?.cac} color={COLORS.brandBlueMid} icon="🎯" inv />
      </div>
      {/* KPIs — row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mb-7">
        <KpiCard title="CPL" value={fmt(CURR.cpl)} sub={`${CURR.leads_total} leads totais`}
          curr={CURR.cpl} prev={PREV?.cpl} color={COLORS.cpl} icon="👥" inv />
        <KpiCard
          title="Leads / R$1k investido"
          value={CURR.inv > 0 ? ((CURR.leads_total / CURR.inv) * 1000).toFixed(1) : '—'}
          sub="Produtividade de mídia"
          color={COLORS.brandBlueLight}
          icon="⚡"
        />
      </div>

      {/* Critical ROI alert */}
      {CURR.roi < 8 && (
        <div className="mb-5 p-4 rounded-2xl bg-red-500/10 border border-brand-red/30 flex items-start gap-3">
          <span className="text-2xl">🚨</span>
          <div>
            <p className="text-brand-red font-bold text-sm mb-1">ROI Crítico em {CURR.label}</p>
            <p className="text-red-300/80 text-xs">
              ROI de {CURR.roi}x com investimento de {fmt(CURR.inv)} e {CURR.qtd_v} vendas fechadas ({fmt(CURR.rec_v)}).
              {CURR.aberto > 0 && ` ${CURR.aberto} deal(s) ainda em aberto podem converter nas próximas semanas.`}
            </p>
          </div>
        </div>
      )}

      {/* Investment breakdown */}
      {CURR.inv_breakdown && Object.keys(CURR.inv_breakdown).length > 0 && (
        <div className="glass-card rounded-2xl p-5 mb-5">
          <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-4">Investimento por Canal — {isRange ? 'Período' : CURR.label}</p>
          <div className="space-y-3">
            {Object.entries(CURR.inv_breakdown).map(([canal, val]) => (
              <div key={canal}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">{canal}</span>
                  <span className="text-brand-blue-light font-bold">{fmt(val)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-brand-blue-light"
                    style={{ width: `${CURR.inv > 0 ? (val / CURR.inv) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ROI + CPL chart */}
      <div className="glass-card rounded-2xl p-5 mb-5">
        <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-4">ROI e CPL — Período Selecionado</p>
        <RoiCplComposed data={trend} N={N} />
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-auto">
        <div className="p-5 border-b border-gray-200">
          <p className="text-gray-900 font-semibold text-sm">Tabela de Investimentos</p>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-gray-600 uppercase tracking-wider">
              <th className="p-4 text-left">Mês</th>
              <th className="p-4 text-right">Investimento</th>
              <th className="p-4 text-right">Leads</th>
              <th className="p-4 text-right">CPL</th>
              <th className="p-4 text-right">Vendas</th>
              <th className="p-4 text-right">ROI</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => (
              <tr
                key={d.ym}
                className={`border-b border-gray-100 hover:bg-gray-50 ${
                  i === filtered.length - 1 ? 'bg-brand-blue/10' : ''
                }`}
              >
                <td className={`p-4 font-bold ${i === filtered.length - 1 ? 'text-brand-blue-light' : 'text-gray-600'}`}>
                  {d.label}{i === filtered.length - 1 ? ' ★' : ''}
                </td>
                <td className="p-4 text-right text-brand-blue-light font-mono">{fmt(d.inv)}</td>
                <td className="p-4 text-right text-gray-600">{d.leads_total}</td>
                <td className="p-4 text-right text-cyan-400 font-mono">{fmt(d.cpl)}</td>
                <td className="p-4 text-right text-green-400 font-mono">{fmt(d.rec_v)}</td>
                <td className="p-4 text-right">
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${sclCls(d.roi, [15, 10])}`}>
                    {d.roi}x
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
