import { useState } from 'react';
import { SectionHeader } from '../components/ui/SectionHeader.jsx';
import { MotifBars } from '../components/ui/MotifBars.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { ProposalValueStackedBar } from '../components/charts/ProposalValueStackedBar.jsx';
import { fmt } from '../utils/formatters.js';
import { THR, COLORS } from '../constants/index.js';
import { closerRespToArr } from '../utils/respToArray.js';

export function Tab3_PerformanceClosers({ CURR, trend6, filtered, isRange }) {
  const [sel, setSel] = useState(null);
  if (!CURR) return null;

  const closerArr = closerRespToArr(CURR.closer_resp, CURR.vendas_resp);

  // Concentration alert
  const concentration = closerArr.reduce((max, r) => {
    const share = CURR.rec_v > 0 ? (r.receita / CURR.rec_v) * 100 : 0;
    return share > max.share ? { nome: r.nome, share } : max;
  }, { nome: '', share: 0 });

  // Mini sparkline (revenue history per closer)
  const allClosers = [...new Set(filtered.flatMap(d => Object.keys(d.vendas_resp || {})))];

  return (
    <div>
      <SectionHeader number={3} title="Performance de Closers" subtitle="👆 Clique no nome para filtrar motivos de perda" />

      {concentration.share > 60 && (
        <div className="mb-5 p-4 rounded-2xl bg-red-500/10 border border-brand-red/30 flex items-start gap-3">
          <span className="text-xl">🚨</span>
          <p className="text-red-300 text-xs">
            <strong>Concentração crítica:</strong> {concentration.nome} responsável por {concentration.share.toFixed(0)}% da receita ({fmt((concentration.share/100)*CURR.rec_v)}).
          </p>
        </div>
      )}

      {/* Main table */}
      <div className="glass-card rounded-2xl mb-5 overflow-auto">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-gray-900 font-semibold text-sm">Pipeline por Closer — {isRange ? 'Período' : CURR.label}</p>
            <p className="text-gray-600 text-xs mt-0.5">Leads criados no período selecionado{isRange ? ` (${CURR.label})` : ''}</p>
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
              {['Closer','Leads','Ganhos','Perdidos','Em Aberto','Taxa Fech.','Receita','Status'].map(h => (
                <th key={h} className={`p-4 text-gray-600 uppercase tracking-wider text-xs ${h==='Receita'?'text-right':h==='Closer'?'text-left':'text-center'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {closerArr.map((r, i) => {
              const isSel = sel === r.nome;
              const status = r.ganho >= 1 && r.aberto > 10
                ? <span className="text-orange-500">⚠️ Pipeline cheio</span>
                : r.ganho > 0
                ? <span className="text-green-400">✅ Ativo</span>
                : <span className="text-brand-red">🚨 0 ganhos</span>;
              return (
                <>
                  <tr
                    key={i}
                    onClick={() => setSel(isSel ? null : r.nome)}
                    className={`border-b border-gray-100 cursor-pointer transition-all ${
                      isSel ? 'bg-purple-500/10 border-purple-500/30' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="p-4 font-semibold" style={{ color: isSel ? '#a855f7' : '#1e293b' }}>
                      {r.nome} {isSel ? '▲' : '▼'}
                    </td>
                    <td className="p-4 text-center text-gray-600">{r.total}</td>
                    <td className="p-4 text-center text-green-400 font-bold">{r.ganho}</td>
                    <td className="p-4 text-center text-red-400">{r.perdido}</td>
                    <td className="p-4 text-center font-bold" style={{ color: '#64748b' }}>{r.aberto}</td>
                    <td className="p-4 text-center">
                      <StatusBadge value={r.taxa} thr={THR.taxaFechCloser}>{r.taxa}%</StatusBadge>
                    </td>
                    <td className="p-4 text-right font-bold font-mono">{r.receita > 0 ? fmt(r.receita) : '—'}</td>
                    <td className="p-4 text-center text-xs">{status}</td>
                  </tr>
                  {isSel && (
                    <tr key={`mp-${i}`} className="bg-purple-500/5 border-b border-purple-500/20">
                      <td colSpan={8} className="p-0">
                        <div className="px-5 pb-4 pt-2">
                          <p className="text-purple-400 text-xs font-semibold uppercase tracking-wider mb-1">
                            Motivos de Perda — {r.nome}
                          </p>
                          {CURR.closer_mp_resp?.[r.nome]
                            ? <MotifBars motivos={CURR.closer_mp_resp[r.nome]} color="#a855f7" />
                            : <p className="text-gray-600 text-xs py-2">Nenhuma perda registrada no período.</p>}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Motivos geral + Receita histórica */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-1">Motivos de Perda — Geral {isRange ? 'Período' : CURR.label}</p>
          <MotifBars motivos={CURR.mp_closer} color={COLORS.brandRed} />
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-4">Receita por Closer — Histórico</p>
          <div className="space-y-3">
            {allClosers.map(nome => {
              const bars = filtered.map(d => d.vendas_resp?.[nome]?.receita ?? 0);
              const mx   = Math.max(...bars, 1);
              const last = bars[bars.length - 1];
              return (
                <div key={nome} className="flex items-end gap-2">
                  <span className="text-gray-600 text-xs w-20 flex-shrink-0 truncate">{nome.split(' ')[0]}</span>
                  <div className="flex items-end gap-1 flex-1 h-10">
                    {bars.map((v, i) => (
                      <div
                        key={i}
                        title={`${filtered[i]?.label}: ${fmt(v)}`}
                        className="flex-1 rounded-sm"
                        style={{
                          height: `${Math.max(2, (v / mx) * 36)}px`,
                          background: i === filtered.length - 1 ? (v > 0 ? COLORS.vendas : '#374151') : '#374151',
                          opacity: i === filtered.length - 1 ? 1 : 0.45,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-mono w-20 text-right" style={{ color: last > 0 ? COLORS.vendas : '#6b7280' }}>
                    {last > 0 ? fmt(last) : 'R$0'}
                  </span>
                </div>
              );
            })}
            <div className="flex text-gray-600 text-xs justify-between mt-1 pl-[5.5rem]">
              <span>{filtered[0]?.label}</span>
              <span>{filtered[filtered.length - 1]?.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Evolução de Valor em Propostas — últimos 6 meses, por mês de criação */}
      <div className="glass-card rounded-2xl p-5 mt-5">
        <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-1">
          Evolução de Valor em Propostas — Últimos 6 Meses
        </p>
        <p className="text-gray-600 text-xs mb-4">
          Valor total gerenciado pelos closers por mês de criação (Convertido + Perdido + Em Aberto) · status atual
        </p>
        <ProposalValueStackedBar data={trend6} />
      </div>

      {/* Evolução de Valor Rentabilização (Expansão) — últimos 6 meses */}
      <div className="glass-card rounded-2xl p-5 mt-5">
        <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-1">
          Evolução de Valor Rentabilização (Expansão) — Últimos 6 Meses
        </p>
        <p className="text-gray-600 text-xs mb-4">
          Valor total gerenciado em Rentabilização por mês de criação (Convertido + Perdido + Em Aberto) · status atual
        </p>
        <ProposalValueStackedBar
          data={trend6}
          keys={{ ganho: 'rent_valor_ganho', perdido: 'rent_valor_perdido', aberto: 'rent_valor_aberto' }}
          qtyKeys={{ ganho: 'rent_qtd_ganho', perdido: 'rent_qtd_perdido', aberto: 'rent_qtd_aberto' }}
        />
      </div>
    </div>
  );
}
