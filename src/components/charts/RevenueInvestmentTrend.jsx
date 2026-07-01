import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartTooltip } from '../ui/ChartTooltip.jsx';
import { fmt, fmtK } from '../../utils/formatters.js';
import { COLORS } from '../../constants/index.js';

const METRIC_ROWS = [
  { key: 'leads',    label: 'Leads',              fmt: v => v },
  { key: 'reunioes', label: 'Volume de Reuniões', fmt: v => v },
  { key: 'qtd',      label: 'Vendas',             fmt: v => v },
  { key: 'taxa',  label: 'Tx. Conversão', fmt: v => `${v}%` },
  { key: 'roi',   label: 'ROI',           fmt: v => `${v}x` },
  { key: 'cac',   label: 'CAC',           fmt: v => fmt(v) },
];

export function RevenueInvestmentTrend({ data, height = 220 }) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="mes" tick={{ fill: '#4b5563', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmtK} tick={{ fill: '#4b5563', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip currency />} />
          <Legend wrapperStyle={{ color: '#374151', fontSize: '11px' }} />
          <Bar dataKey="inv"         name="Investido"    fill={COLORS.brandRed} radius={[4, 4, 0, 0]} />
          <Bar dataKey="faturamento" name="Faturamento"  fill={COLORS.ganho}    radius={[4, 4, 0, 0]} />
          <Bar dataKey="lucro"       name="Lucro Bruto"  fill={COLORS.vendas}   radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <tbody>
            {METRIC_ROWS.map(row => (
              <tr key={row.key} className="border-t border-gray-100">
                <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">{row.label}</td>
                {data.map((d, i) => (
                  <td key={i} className="py-1.5 px-2 text-center text-gray-700 font-medium">
                    {row.fmt(d[row.key])}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-gray-100">
              <td className="py-1.5 pr-3 text-gray-400 whitespace-nowrap">Mês</td>
              {data.map((d, i) => (
                <td key={i} className="py-1.5 px-2 text-center text-gray-400">{d.mes}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
