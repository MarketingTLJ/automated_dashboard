import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { SectionHeader } from '../components/ui/SectionHeader.jsx';
import { MotifBars } from '../components/ui/MotifBars.jsx';
import { ChartTooltip } from '../components/ui/ChartTooltip.jsx';
import { fmt, fmtK } from '../utils/formatters.js';
import { COLORS, CHART_OPACITY } from '../constants/index.js';

export function Tab5_PropostasPerdidas({ CURR, trend, N, filtered, isRange }) {
  const [sel, setSel] = useState(null);
  if (!CURR) return null;

  const pp = CURR.pp ?? { total: 0, valor: 0, por_resp: {}, motivos_geral: {} };
  const ppArr = Object.entries(pp.por_resp || {})
    .map(([nome, d]) => ({ nome, ...d }))
    .sort((a, b) => b.total - a.total);

  // PP evolution trend
  const ppTrend = trend.map(d => ({
    mes:    d.mes,
    perdas: d.pp?.total  ?? 0,
    valor:  d.pp?.valor  ?? 0,
  }));

  const top1Motivo = Object.entries(pp.motivos_geral || {})[0];

  return (
    <div>
      <SectionHeader number={5} title="Propostas Perdidas"
        subtitle={isRange ? `Fase=Perdido · Data de Fechamento no período (${CURR.label})` : `Fase=Perdido · Data de Fechamento em ${CURR.label}`} />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
        <div className="bg-surface-card border border-brand-red/30 rounded-2xl p-5 col-span-2 md:col-span-1">
          <p className="text-gray-600 text-xs uppercase tracking-widest mb-3">Negócios Perdidos</p>
          <p className="text-4xl font-black text-brand-red">{pp.total}</p>
          <p className="text-gray-600 text-xs mt-1">etapa Perdido · {isRange ? 'Período' : CURR.label}</p>
        </div>
        <div className="bg-surface-card border border-brand-red/30 rounded-2xl p-5 col-span-2 md:col-span-1">
          <p className="text-gray-600 text-xs uppercase tracking-widest mb-3">Receita Perdida</p>
          <p className="text-3xl font-black text-brand-red">{fmt(pp.valor)}</p>
          <p className="text-gray-600 text-xs mt-1">valor total dos negócios</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-gray-600 text-xs uppercase tracking-widest mb-3">Ticket Médio Perdido</p>
          <p className="text-3xl font-black text-gray-700">{pp.total > 0 ? fmt(pp.valor / pp.total) : '—'}</p>
          <p className="text-gray-600 text-xs mt-1">por negócio</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-gray-600 text-xs uppercase tracking-widest mb-3">Razão Perdido/Ganho</p>
          <p className="text-3xl font-black text-brand-red">{pp.total}:{CURR.qtd_v}</p>
          <p className="text-gray-600 text-xs mt-1">
            {CURR.qtd_v > 0 ? (pp.total / CURR.qtd_v).toFixed(1) : '∞'}x mais perdas que vendas
          </p>
        </div>
      </div>

      {/* PP trend */}
      <div className="glass-card rounded-2xl p-5 mb-5">
        <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-4">Evolução de Perdas — Período Selecionado</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={ppTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="perdas" name="Negócios Perdidos" radius={[3, 3, 0, 0]}>
              {ppTrend.map((_, i) => <Cell key={i} fill={COLORS.brandRed} opacity={i === N ? CHART_OPACITY.active : CHART_OPACITY.past} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl mb-5 overflow-auto">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-gray-900 font-semibold text-sm">Propostas Perdidas por Responsável</p>
            <p className="text-gray-600 text-xs mt-0.5">👆 Clique para ver motivos individuais</p>
          </div>
          {sel && (
            <button onClick={() => setSel(null)} className="text-xs text-gray-600 hover:text-gray-900 bg-gray-100 px-3 py-1.5 rounded-lg ml-4">
              ✕ Limpar
            </button>
          )}
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              {['Responsável','Negócios','Valor Perdido','% dos Perdidos','% do Valor','Ticket Médio'].map(h => (
                <th key={h} className={`p-4 text-gray-600 uppercase tracking-wider text-xs ${h==='Responsável'?'text-left':'text-right'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ppArr.map((r, i) => {
              const isSel = sel === r.nome;
              return (
                <>
                  <tr
                    key={i}
                    onClick={() => setSel(isSel ? null : r.nome)}
                    className={`border-b border-gray-100 cursor-pointer transition-all ${
                      isSel ? 'bg-red-500/10 border-brand-red/30' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="p-4 font-semibold" style={{ color: isSel ? '#f87171' : '#1e293b' }}>
                      {r.nome} {isSel ? '▲' : '▼'}
                    </td>
                    <td className="p-4 text-right text-brand-red font-bold text-base">{r.total}</td>
                    <td className="p-4 text-right text-brand-red font-mono font-bold">{fmt(r.valor)}</td>
                    <td className="p-4 text-right text-gray-600">
                      {pp.total > 0 ? ((r.total / pp.total) * 100).toFixed(0) : 0}%
                    </td>
                    <td className="p-4 text-right text-gray-600">
                      {pp.valor > 0 ? ((r.valor / pp.valor) * 100).toFixed(0) : 0}%
                    </td>
                    <td className="p-4 text-right text-gray-700 font-mono">
                      {r.total > 0 ? fmt(r.valor / r.total) : '—'}
                    </td>
                  </tr>
                  {isSel && (
                    <tr key={`pp-${i}`} className="bg-red-500/5 border-b border-brand-red/20">
                      <td colSpan={6} className="p-0">
                        <div className="px-5 pb-4 pt-2">
                          <p className="text-brand-red text-xs font-semibold uppercase tracking-wider mb-2">
                            Motivos — {r.nome} · {r.total} negócios · {fmt(r.valor)}
                          </p>
                          <MotifBars motivos={r.motivos} color={COLORS.brandRed} />
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            <tr className="bg-red-500/5 border-t-2 border-brand-red/30">
              <td className="p-4 font-black text-brand-red">TOTAL</td>
              <td className="p-4 text-right text-brand-red font-black text-base">{pp.total}</td>
              <td className="p-4 text-right text-brand-red font-black font-mono">{fmt(pp.valor)}</td>
              <td className="p-4 text-right text-gray-600">100%</td>
              <td className="p-4 text-right text-gray-600">100%</td>
              <td className="p-4 text-right text-gray-700 font-mono">
                {pp.total > 0 ? fmt(pp.valor / pp.total) : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Motivos + Receita perdida */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-1">Motivos de Perda — Geral {isRange ? 'Período' : CURR.label}</p>
          <MotifBars motivos={pp.motivos_geral} color={COLORS.brandRed} />
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-4">Receita Perdida por Responsável</p>
          <div className="space-y-3">
            {ppArr.map((r, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-700 font-medium">{r.nome.split(' ')[0]}</span>
                  <span className="text-brand-red font-bold font-mono">{fmt(r.valor)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-red-600"
                    style={{ width: `${ppArr[0]?.valor > 0 ? (r.valor / ppArr[0].valor) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-gray-600 text-xs mt-0.5">
                  {r.total} negócios · {pp.valor > 0 ? ((r.valor / pp.valor) * 100).toFixed(0) : 0}%
                </p>
              </div>
            ))}
          </div>
          {top1Motivo && (
            <div className="mt-5 p-3 rounded-xl bg-red-500/10 border border-brand-red/20">
              <p className="text-brand-red text-xs font-semibold mb-1">🔎 Principal Insight</p>
              <p className="text-red-300/80 text-xs">
                "{top1Motivo[0]}" = motivo #1 com {top1Motivo[1]} de {pp.total} perdas
                ({pp.total > 0 ? ((top1Motivo[1] / pp.total) * 100).toFixed(0) : 0}%).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
