const STYLES = {
  red:   'bg-red-50   border-red-200   text-red-700',
  amber: 'bg-amber-50 border-amber-200 text-amber-700',
  green: 'bg-green-50 border-green-200 text-green-700',
};

export function AlertBanner({ type, icon, message }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border text-xs leading-relaxed ${STYLES[type] ?? STYLES.amber}`}>
      <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
      <p>{message}</p>
    </div>
  );
}
