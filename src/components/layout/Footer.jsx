// '2026-10-01T06:02' → '01/10/2026 às 06:02'
const fmtAtualizado = iso => {
  if (!iso) return null;
  const [d, t] = iso.split('T');
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y} às ${t}`;
};

export function Footer({ firstLabel, lastLabel, atualizadoEm }) {
  const upd = fmtAtualizado(atualizadoEm);
  return (
    <div className="border-t border-gray-200 mt-12 px-6 py-4 flex items-center justify-between bg-white/60">
      <p className="text-gray-400 text-xs">
        Grupo TLJ · Dashboard Comercial · Base CRM Bitrix24
        {upd && <span> · Dados atualizados em {upd}</span>}
      </p>
      <p className="text-gray-300 text-xs">{firstLabel} → {lastLabel}</p>
    </div>
  );
}
