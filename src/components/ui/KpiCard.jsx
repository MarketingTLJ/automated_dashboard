import { DeltaBadge } from './DeltaBadge.jsx';

export function KpiCard({ title, value, sub, curr, prev, inv, color = '#213761', icon }) {
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <span className="text-gray-700 text-xs uppercase tracking-widest leading-tight font-medium">{title}</span>
        {icon && <span className="text-xl opacity-60">{icon}</span>}
      </div>
      <p className="text-3xl font-black leading-none" style={{ color }}>{value}</p>
      <div className="flex items-center gap-2 flex-wrap min-h-[1.25rem]">
        {sub && <span className="text-gray-600 text-xs">{sub}</span>}
        {curr !== undefined && prev !== undefined && (
          <DeltaBadge curr={curr} prev={prev} inv={inv} />
        )}
      </div>
    </div>
  );
}
