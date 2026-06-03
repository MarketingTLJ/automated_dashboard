export function MotifBars({ motivos, color = '#E31E24' }) {
  if (!motivos || !Object.keys(motivos).length) {
    return <p className="text-gray-600 text-xs p-4">Sem motivos registrados.</p>;
  }
  const arr = Object.entries(motivos).sort((a, b) => b[1] - a[1]);
  const max = arr[0][1];
  return (
    <div className="p-4 space-y-2.5">
      {arr.map(([name, val]) => (
        <div key={name}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-700 truncate max-w-[76%]">{name}</span>
            <span className="font-bold ml-2" style={{ color }}>{val}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${(val / max) * 100}%`, background: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
