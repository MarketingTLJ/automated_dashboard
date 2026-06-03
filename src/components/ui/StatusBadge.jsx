import { sclCls } from '../../utils/formatters.js';

export function StatusBadge({ value, thr, children }) {
  return (
    <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${sclCls(value, thr)}`}>
      {children ?? `${value}%`}
    </span>
  );
}
