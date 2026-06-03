import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { SectionHeader } from '../components/ui/SectionHeader.jsx';
import { KpiCard } from '../components/ui/KpiCard.jsx';
import { ChartTooltip } from '../components/ui/ChartTooltip.jsx';
import { fmt, fmtK } from '../utils/formatters.js';
import { COLORS, CHART_OPACITY, THR_RENOVACAO } from '../constants/index.js';

function taxaColor(taxa) {
  if (taxa >= THR_RENOVACAO.good) return COLORS.success;
  if (taxa >= THR_RENOVACAO.warn) return COLORS.warning;
  return COLORS.danger;
}

export function Tab7_Licencas({ CURR, PREV, filteredTermino, isRange }) {
  if (!CURR) return null;

  const lc_total      = CURR.lc_total      || 0;
  const lc_renovado   = CURR.lc_renovado   || 0;
  const lc_cancelado  = CURR.lc_cancelado  || 0;
  const lc_aberto     = CURR.lc_aberto     || 0;
  const lc_taxa       = CURR.lc_taxa_renovacao || 0;
  const lc_rec_ren    = CURR.lc_rec_renovado   || 0;
  const lc_rec_can    = CURR.lc_rec_cancelado  || 0;
  const lc_resp       = CURR.lc_resp           || {};
  const lc_bitrix     = CURR.lc_bitrix_uso     || {};
  const lc_motivos    = CURR.lc_motivos_churn  || {};

  // Monthly trend from filteredTermino
  const lcTrend = (filteredTermino || []).map(d => ({
    mes:       d.label,
    renovado:  d.lc_renovado  || 0,
    cancelado: d.lc_cancelado || 0,
    aberto:    d.lc_aberto    || 0,
    taxa:      d.lc_taxa_renovacao || 0,
    rec_ren:   d.lc_rec_renovado  || 0,
  })).filter(d => d.renovado + d.cancelado + d.aberto > 0);

  // By responsible — sorted by total desc
  const respArr = Object.entries(lc_resp)
    .map(([nome, s]) => ({ nome, ...s }))
    .sort((a, b) => b.total - a.total);

  // Bitrix usage — clean up compound values
  const bitrixArr = Object.entries(lc_bitrix)
    .map(([label, val]) => ({ label: label.replace(', Sem acesso ao Bitrix do cliente', '').replace('Sem acesso ao Bitrix do cliente, ', '').trim(), val })
    )
    .sort((a, b) => b.val - a.val);

  // Motivos churn
  const motivosArr = Object.entries(lc_motivos)
    .map(([label, val]) => ({ label, val }))
    .sort((a, b) => b.val - a.val);

  const taxaCor = taxaColor(lc_taxa);
  const hasData = lc_total > 0;

  return (
    <div>
      <SectionHeader
        number={7}
        title="Licenças CS"
        subtitle={
          isRange
            ? `Renovações e Churn de Licenças Bitrix24 · ${CURR.label}`
            : `Renovações e Churn · ${CURR.label} — filtro: Data de Vencimento`
        }
      />

      {!hasData && (
        <div className="glass-card rounded-2xl p-8 text-center text-gray-500">
          <p className="text-lg font-semibold mb-2">Sem licenças com vencimento no período selecionado</p>
          <p className="text-sm">Ajuste o filtro "Data de Término" para ver os dados de Licenças CS.</p>
        </div>
      )}

      {hasData && (
        <>
          {/* ── KPIs Principais ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
            <KpiCard
              title="Total com Vencimento"
              value={lc_total}
              sub={isRange ? 'Total período' : CURR.label}
              color={COLORS.muted}
              icon="📋"
            />
            <KpiCard
              title="Renovadas"
              value={lc_renovado}
              sub={`${fmt(lc_rec_ren)}`}
              curr={lc_renovado}
              prev={PREV?.lc_renovado}
              color={COLORS.lcRenovado}
              icon="✅"
            />
            <KpiCard
              title="Canceladas / Churn"
              value={lc_cancelado}
              sub={`Risco: ${fmt(lc_rec_can)}`}
              curr={lc_cancelado}
              prev={PREV?.lc_cancelado}
              color={COLORS.lcCancelado}
              icon="❌"
              inv
            />
            <KpiCard
              title="Taxa de Renovação"
              value={`${lc_taxa.toFixed(1)}%`}
              sub={`${lc_aberto} em aberto`}
              curr={lc_taxa}
              prev={PREV?.lc_taxa_renovacao}
              color={taxaCor}
              icon="🔄"
            />
          </div>

          {/* ── Receita ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-7">
            <div className="glass-card rounded-2xl p-5">
              <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-3">
                Receita de Licenças — {isRange ? 'Período' : CURR.label}
              </p>
              <div className="space-y-4">
                {[
                  { label: 'Receita Renovada',  val: lc_rec_ren, color: COLORS.lcRenovado  },
                  { label: 'Risco de Churn',     val: lc_rec_can, color: COLORS.lcCancelado },
                ].map(r => (
                  <div key={r.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{r.label}</span>
                      <span className="font-bold" style={{ color: r.color }}>{fmt(r.val)}</span>
                    </div>
                    {(lc_rec_ren + lc_rec_can) > 0 && (
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{ width: `${((r.val / (lc_rec_ren + lc_rec_can)) * 100).toFixed(0)}%`, background: r.color }}
                        />
                      </div>
                    )}
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-200 flex justify-between text-xs">
                  <span className="text-gray-500">Total movimentado</span>
                  <span className="font-bold text-white">{fmt(lc_rec_ren + lc_rec_can)}</span>
                </div>
              </div>
            </div>

            {/* Bitrix Usage */}
            {bitrixArr.length > 0 && (
              <div className="glass-card rounded-2xl p-5">
                <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-3">
                  Uso do Bitrix pelos Clientes
                </p>
                <div className="space-y-2">
                  {bitrixArr.map(({ label, val }) => {
                    const pct = lc_total > 0 ? ((val / lc_total) * 100).toFixed(0) : 0;
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600 truncate max-w-[160px]" title={label}>{label}</span>
                          <span className="font-bold text-white">{val} <span className="text-gray-400">({pct}%)</span></span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full"
                            style={{ width: `${pct}%`, background: COLORS.brandBlueLight }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Evolução mensal ─────────────────────────────────────────── */}
          {lcTrend.length > 1 && (
            <div className="glass-card rounded-2xl p-5 mb-7">
              <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-4">
                Evolução de Licenças — Renovadas vs Canceladas por Mês de Vencimento
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={lcTrend} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    formatter={v => <span style={{ color: '#6b7280' }}>{v}</span>}
                  />
                  <Bar dataKey="renovado"  name="Renovadas"  fill={COLORS.lcRenovado}  radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cancelado" name="Canceladas" fill={COLORS.lcCancelado} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="aberto"    name="Em Aberto"  fill={COLORS.lcAberto}    radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Por Responsável CS ──────────────────────────────────────── */}
          {respArr.length > 0 && (
            <div className="glass-card rounded-2xl p-5 mb-7">
              <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-4">
                Performance por Responsável CS
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase border-b border-gray-200">
                      <th className="text-left py-2 pr-4">Responsável</th>
                      <th className="text-center py-2 px-3">Total</th>
                      <th className="text-center py-2 px-3">Renovadas</th>
                      <th className="text-center py-2 px-3">Canceladas</th>
                      <th className="text-center py-2 px-3">Em Aberto</th>
                      <th className="text-center py-2 px-3">Taxa Ren.</th>
                      <th className="text-right py-2 pl-3">Rec. Renovada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {respArr.map(({ nome, total, renovado, cancelado, aberto, rec_renovado }) => {
                      const taxa = (renovado + cancelado) > 0
                        ? ((renovado / (renovado + cancelado)) * 100).toFixed(0)
                        : '—';
                      const cor  = typeof taxa === 'string' ? COLORS.muted : taxaColor(Number(taxa));
                      return (
                        <tr key={nome} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-2.5 pr-4 font-medium text-gray-700">{nome}</td>
                          <td className="text-center py-2.5 px-3 text-gray-600">{total}</td>
                          <td className="text-center py-2.5 px-3 font-semibold" style={{ color: COLORS.lcRenovado }}>{renovado}</td>
                          <td className="text-center py-2.5 px-3 font-semibold" style={{ color: COLORS.lcCancelado }}>{cancelado}</td>
                          <td className="text-center py-2.5 px-3 text-gray-500">{aberto}</td>
                          <td className="text-center py-2.5 px-3 font-bold" style={{ color: cor }}>
                            {typeof taxa === 'string' ? taxa : `${taxa}%`}
                          </td>
                          <td className="text-right py-2.5 pl-3 font-semibold" style={{ color: COLORS.lcRenovado }}>
                            {rec_renovado > 0 ? fmtK(rec_renovado) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Motivos de Churn ─────────────────────────────────────────── */}
          {motivosArr.length > 0 && (
            <div className="glass-card rounded-2xl p-5">
              <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-4">
                Motivos de Cancelamento (Churn)
              </p>
              <ResponsiveContainer width="100%" height={Math.max(120, motivosArr.length * 36)}>
                <BarChart data={motivosArr} layout="vertical" margin={{ left: 8, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="label" type="category" tick={{ fill: '#374151', fontSize: 11 }} axisLine={false} tickLine={false} width={180} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="val" name="Cancelamentos" fill={COLORS.lcCancelado} radius={[0, 4, 4, 0]}>
                    {motivosArr.map((_, i) => (
                      <Cell key={i} fill={COLORS.lcCancelado} opacity={i === 0 ? 1 : CHART_OPACITY.past} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
