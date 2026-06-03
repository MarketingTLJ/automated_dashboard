import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { ChartTooltip } from '../ui/ChartTooltip.jsx';
import { COLORS } from '../../constants/index.js';

export function WinLossBar({ data, N, height = 220 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barGap={3}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="mes" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ color: '#374151', fontSize: '11px' }} />
        <Bar dataKey="ganho" name="Ganhos" radius={[3, 3, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS.ganho} opacity={i === N ? 1 : 0.4} />)}
        </Bar>
        <Bar dataKey="perdido" name="Perdidos" radius={[3, 3, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS.perdido} opacity={i === N ? 1 : 0.4} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
