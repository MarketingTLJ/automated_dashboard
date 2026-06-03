import { dp } from '../../utils/formatters.js';

export function DeltaBadge({ curr, prev, inv = false }) {
  const d = dp(curr, prev);
  if (!d) return null;
  const up   = parseFloat(d) > 0;
  const good = inv ? !up : up;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-md ${
        good
          ? 'bg-green-500/20 text-green-400'
          : 'bg-red-500/20 text-red-400'
      }`}
    >
      {up ? '▲' : '▼'} {Math.abs(d)}%
    </span>
  );
}
