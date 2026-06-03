export function Footer({ firstLabel, lastLabel }) {
  return (
    <div className="border-t border-gray-200 mt-12 px-6 py-4 flex items-center justify-between bg-white/60">
      <p className="text-gray-400 text-xs">Grupo TLJ · Dashboard Comercial · Base CRM Bitrix24</p>
      <p className="text-gray-300 text-xs">{firstLabel} → {lastLabel}</p>
    </div>
  );
}
