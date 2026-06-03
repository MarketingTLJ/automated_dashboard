import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer, Cell } from 'recharts';
import { ChartTooltip } from '../ui/ChartTooltip.jsx';
import { scl } from '../../utils/formatters.js';
import { THR, COLORS, ROI_TARGET, CHART_OPACITY } from '../../constants/index.js';

export function RoiCplComposed({ data, N, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="mes" tick={{ fill: '#4b5563', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="l" tick={{ fill: '#4b5563', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          yAxisId="r"
          orientation="right"
          tickFormatter={v => `R$${v}`}
          tick={{ fill: '#4b5563', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ color: '#374151', fontSize: '11px' }} />
        <Bar yAxisId="l" dataKey="roi" name="ROI (x)" radius={[4, 4, 0, 0]}>
          {data.map((e, i) => (
            <Cell key={i} fill={scl(e.roi, THR.roi)} opacity={i === N ? CHART_OPACITY.active : CHART_OPACITY.past} />
          ))}
        </Bar>
        <Line
          yAxisId="r"
          dataKey="cpl"
          name="CPL (R$)"
          type="monotone"
          stroke={COLORS.cpl}
          dot={{ fill: COLORS.cpl, r: 4 }}
          strokeWidth={2}
        />
        <ReferenceLine
          yAxisId="l"
          y={ROI_TARGET}
          stroke={COLORS.success}
          strokeDasharray="4 4"
          label={{ value: `Meta ${ROI_TARGET}x`, fill: COLORS.success, fontSize: 9, position: 'insideTopRight' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
