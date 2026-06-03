import { useState } from 'react';
import { SectionHeader } from '../components/ui/SectionHeader.jsx';
import { KpiCard } from '../components/ui/KpiCard.jsx';
import { MotifBars } from '../components/ui/MotifBars.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { pct } from '../utils/formatters.js';
import { THR, COLORS, THR_PERDA_SDR } from '../constants/index.js';
import { sdrRespToArr } from '../utils/respToArray.js';

export function Tab4_AnaliseSdr({ CURR, PREV, filtered, isRange }) {
  const [sel, setSel] = useState(null);
  if (!CURR) return null;

  const sdrArr = sdrRespToArr(CURR.sdr_resp);

  const fonteSd = Object.entries(CURR.fonte_sdr || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const maxFonte = fonteSd[0]?.value ?? 1;

  return (
    <div>
      <SectionHeader number={4} title="Análise SDR & Geração de Leads" subtitle="👆 Clique no nome para filtrar motivos de perda" />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
        <KpiCard title="Total Leads Gerados" value={CURR.leads_total}
          sub={`SDR ${CURR.leads_sdr} + Closer ${CURR.leads_closer}`}
          curr={CURR.leads_total} prev={PREV?.leads_total} color={COLORS.leads} icon="🎯" />
        <KpiCard title="Reuniões (Closer)" value={CURR.reunioes}
          sub="Leads criados no Closer"
          curr={CURR.reunioes} prev={PREV?.reunioes} color={COLORS.reunioes} icon="📅" />
        <KpiCard title="Em Andamento SDR" value={CURR.sdr_ativo}
          sub={pct(CURR.sdr_ativo, CURR.leads_sdr) + ' dos leads SDR'}
          curr={CURR.sdr_ativo} prev={PREV?.sdr_ativo} color="#22c55e" icon="⏳" />
        <KpiCard title="Perdidos SDR" value={CURR.sdr_perdido}
          sub={pct(CURR.sdr_perdido, CURR.leads_sdr) + ' dos leads SDR'}
          curr={CURR.sdr_perdido} prev={PREV?.sdr_perdido} color={COLORS.brandRed} icon="❌" inv />
      </div>

      {/* SDR table */}
      <div className="glass-card rounded-2xl mb-5 overflow-auto">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-gray-900 font-semibold text-sm">SDR por Responsável — {isRange ? 'Período' : CURR.label}</p>
            <p className="text-gray-600 text-xs mt-0.5">Taxa Conv = leads col #TLJ# SDR no Closer ÷ total SDR do responsável</p>
          </div>
          {sel && (
            <button onClick={() => setSel(null)} className="text-xs text-gray-600 hover:text-gray-900 bg-gray-100 px-3 py-1.5 rounded-lg ml-4 flex-shrink-0">
              ✕ Limpar
            </button>
          )}
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              {['SDR','Leads SDR','Ao Closer','Perdidos SDR','Taxa Conv.','Taxa Perda'].map(h => (
                <th key={h} className={`p-4 text-gray-600 uppercase tracking-wider text-xs ${h==='SDR'?'text-left':'text-center'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sdrArr.map((r, i) => {
              const isSel = sel === r.nome;
              return (
                <>
                  <tr
                    key={i}
                    onClick={() => setSel(isSel ? null : r.nome)}
                    className={`border-b border-gray-100 cursor-pointer transition-all ${
                      isSel ? 'bg-cyan-500/10 border-cyan-500/30' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="p-4 font-semibold" style={{ color: isSel ? '#06b6d4' : '#1e293b' }}>
                      {r.nome} {isSel ? '▲' : '▼'}
                    </td>
                    <td className="p-4 text-center text-gray-600">{r.total}</td>
                    <td className="p-4 text-center text-green-400 font-bold">{r.conv_closer}</td>
                    <td className="p-4 text-center text-red-400">{r.perdido}</td>
                    <td className="p-4 text-center">
                      {r.total < 5
                        ? <span className="text-gray-600">N/A</span>
                        : <StatusBadge value={r.taxaConv} thr={THR.taxaConvSdr}>{r.taxaConv}%</StatusBadge>
                      }
                    </td>
                    <td className="p-4 text-center">
                      <span className={`text-xs font-bold ${
                        r.taxaPerda > THR_PERDA_SDR.critical ? 'text-red-400'
                        : r.taxaPerda > THR_PERDA_SDR.warn   ? 'text-orange-500'
                        : 'text-gray-600'
                      }`}>{r.taxaPerda}%</span>
                    </td>
                  </tr>
                  {isSel && (
                    <tr key={`mp-s-${i}`} className="bg-cyan-500/5 border-b border-cyan-500/20">
                      <td colSpan={6} className="p-0">
                        <div className="px-5 pb-4 pt-2">
                          <p className="text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-2">
                            Motivos de Perda SDR — {r.nome}
                          </p>
                          {CURR.sdr_mp_resp?.[r.nome]
                            ? <MotifBars motivos={CURR.sdr_mp_resp[r.nome]} color="#06b6d4" />
                            : <p className="text-gray-600 text-xs py-2">Sem motivos registrados.</p>}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
        <div className="p-4 border-t border-gray-200 bg-gray-100/30">
          <p className="text-gray-600 text-xs">
            ℹ️ Taxa Conv. pode ser &gt;100% quando o SDR converte leads de meses anteriores. SDRs com &lt;5 leads marcados como N/A.
          </p>
        </div>
      </div>

      {/* Fonte + Motivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-4">Fonte dos Leads SDR — {isRange ? 'Período' : CURR.label}</p>
          <div className="space-y-3">
            {fonteSd.map((f, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600 truncate max-w-[70%]">{f.name}</span>
                  <span className="text-brand-blue-light font-bold">
                    {f.value} <span className="text-gray-600">({pct(f.value, CURR.leads_sdr)})</span>
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full"
                    style={{ width: `${(f.value / maxFonte) * 100}%`, background: COLORS.brandBlueLight }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-4">Motivos de Perda SDR — Geral {isRange ? 'Período' : CURR.label}</p>
          <MotifBars motivos={CURR.mp_sdr} color={COLORS.brandRed} />
        </div>
      </div>
    </div>
  );
}
