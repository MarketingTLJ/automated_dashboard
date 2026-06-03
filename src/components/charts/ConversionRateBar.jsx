import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChartTooltip } from '../ui/ChartTooltip.jsx';
import { scl } from '../../utils/formatters.js';
import { THR } from '../../constants/index.js';

export function ConversionRateBar({ data, N, height = 200 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="mes" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis unit="%" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="taxa_geral" name="Conv. Geral %" radius={[3, 3, 0, 0]}>
          {data.map((e, i) => (
            <Cell key={i} fill={scl(e.taxa_geral, THR.taxaConvGeral)} opacity={i === N ? 1 : 0.5} />
          ))}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
