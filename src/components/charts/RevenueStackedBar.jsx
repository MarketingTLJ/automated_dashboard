import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { ChartTooltip } from '../ui/ChartTooltip.jsx';
import { fmtK } from '../../utils/formatters.js';
import { COLORS } from '../../constants/index.js';

export function RevenueStackedBar({ data, N, height = 280 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="mes" tick={{ fill: '#4b5563', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmtK} tick={{ fill: '#4b5563', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip currency />} />
        <Legend wrapperStyle={{ color: '#374151', fontSize: '11px' }} />
        <Bar dataKey="vendas" name="Novas Vendas" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS.vendas} opacity={i === N ? 1 : 0.35} />)}
        </Bar>
        <Bar dataKey="inc" name="Incrementos" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS.incrementos} opacity={i === N ? 1 : 0.35} />)}
        </Bar>
        <Bar dataKey="ren" name="Renovações" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS.renovacoes} opacity={i === N ? 1 : 0.35} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
