import { fmt } from '../../utils/formatters.js';

export function ChartTooltip({ active, payload, label, currency = false }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 text-xs shadow-lg min-w-40">
      <p className="text-gray-500 font-semibold mb-2 border-b border-gray-100 pb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: p.color || p.fill }}
          />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-bold text-gray-900">
            {currency
              ? fmt(p.value)
              : typeof p.value === 'number' && p.value % 1 !== 0
              ? p.value.toFixed(1)
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}
