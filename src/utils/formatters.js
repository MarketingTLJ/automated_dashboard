export const fmt = v =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
  }).format(v || 0);

export const fmtK = v => (v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : fmt(v));

export const pct = (a, b) => (b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '—');

export const dp = (c, p) => (p === 0 ? null : (((c - p) / p) * 100).toFixed(1));

export const fmtNum = v =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v || 0);

// Returns green/orange/red color based on [hi, lo] threshold array
export const scl = (v, [hi, lo]) =>
  v >= hi ? '#22c55e' : v >= lo ? '#f97316' : '#E31E24';

// Returns Tailwind class string for badge styling (light theme)
export const sclCls = (v, [hi, lo]) =>
  v >= hi
    ? 'bg-green-50 text-green-700 border-green-200'
    : v >= lo
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-red-50 text-red-700 border-red-200';
