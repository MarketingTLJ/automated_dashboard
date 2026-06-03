export function SectionHeader({ number, title, subtitle }) {
  return (
    <div className="flex items-start gap-4 mb-7">
      <div className="w-10 h-10 rounded-xl bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center text-brand-blue font-black text-sm flex-shrink-0">
        {String(number).padStart(2, '0')}
      </div>
      <div>
        <h2 className="text-gray-900 font-bold text-xl">{title}</h2>
        {subtitle && <p className="text-gray-500 text-sm mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
