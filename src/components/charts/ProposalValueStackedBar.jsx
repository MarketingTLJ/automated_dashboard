import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fmt, fmtK } from '../../utils/formatters.js';
import { COLORS } from '../../constants/index.js';

const DEFAULT_KEYS = { ganho: 'valor_ganho_prop', perdido: 'valor_perdido_prop', aberto: 'valor_aberto_prop' };
const DEFAULT_QTY_KEYS = { ganho: 'ganho', perdido: 'perdido', aberto: 'aberto' };

const STATUS_META = [
  { key: 'ganho',   label: 'Convertido', color: COLORS.ganho },
  { key: 'perdido', label: 'Perdido',    color: COLORS.perdido },
  { key: 'aberto',  label: 'Em Aberto',  color: COLORS.aberto },
];

function ProposalTooltip({ active, payload, label, keys, qtyKeys }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 text-xs shadow-lg min-w-56">
      <p className="text-gray-500 font-semibold mb-2 border-b border-gray-100 pb-1">{label}</p>
      {STATUS_META.map(s => (
        <div key={s.key} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
          <span className="text-gray-500">{s.label}:</span>
          <span className="font-bold text-gray-900">
            {row[qtyKeys[s.key]] ?? 0} Negócios - {fmt(row[keys[s.key]] ?? 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ProposalValueStackedBar({ data, keys = DEFAULT_KEYS, qtyKeys = DEFAULT_QTY_KEYS, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="mes" tick={{ fill: '#4b5563', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmtK} tick={{ fill: '#4b5563', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<ProposalTooltip keys={keys} qtyKeys={qtyKeys} />} />
        <Legend wrapperStyle={{ color: '#374151', fontSize: '11px' }} />
        <Bar dataKey={keys.ganho} name="Convertido" stackId="a" fill={COLORS.ganho} />
        <Bar dataKey={keys.perdido} name="Perdido" stackId="a" fill={COLORS.perdido} />
        <Bar dataKey={keys.aberto} name="Em Aberto" stackId="a" fill={COLORS.aberto} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
