import { useState, useRef, useEffect, useMemo } from 'react';
import { FONTES_PAGAS } from '../../constants/index.js';

const PAGAS_SENTINEL = '__pagas__';

// Checks if all paid fontes present in allFontes are selected
function isPagasSelected(fonteFilter, allFontes) {
  const pagasPresentes = FONTES_PAGAS.filter(f => allFontes.includes(f));
  if (!pagasPresentes.length) return false;
  if (fonteFilter.includes(PAGAS_SENTINEL)) return true;
  return pagasPresentes.every(f => fonteFilter.includes(f));
}

export function FonteSelector({ allFontes = [], fonteFilter = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(fonteFilter);
  const ref = useRef(null);

  // Sync pending when external filter changes (e.g. clear from parent)
  useEffect(() => { setPending(fonteFilter); }, [fonteFilter]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const pagasSelected = useMemo(() => isPagasSelected(pending, allFontes), [pending, allFontes]);
  // Individual fontes (excluding those only reachable via __pagas__)
  const individualFontes = useMemo(() => allFontes.slice().sort(), [allFontes]);

  function togglePagas() {
    if (pagasSelected) {
      // Remove sentinel and all individual paid fontes
      setPending(prev => prev.filter(f => f !== PAGAS_SENTINEL && !FONTES_PAGAS.includes(f)));
    } else {
      // Add sentinel (removes individual paid duplicates for cleanliness)
      setPending(prev => [
        PAGAS_SENTINEL,
        ...prev.filter(f => !FONTES_PAGAS.includes(f)),
      ]);
    }
  }

  function toggleFonte(fonte) {
    const isPaga = FONTES_PAGAS.includes(fonte);
    setPending(prev => {
      if (prev.includes(fonte)) {
        // Deselect: also remove sentinel if this is a paid fonte
        return prev.filter(f => f !== fonte && (isPaga ? f !== PAGAS_SENTINEL : true));
      }
      // Select: if all paid fontes now selected, could keep individual but keep it simple
      return [...prev.filter(f => f !== PAGAS_SENTINEL), fonte];
    });
  }

  function isSelected(fonte) {
    return pending.includes(fonte) || (FONTES_PAGAS.includes(fonte) && pending.includes(PAGAS_SENTINEL));
  }

  function apply() {
    onChange(pending);
    setOpen(false);
  }

  function clear() {
    setPending([]);
    onChange([]);
    setOpen(false);
  }

  // Build label for trigger button
  const activeCount = (() => {
    if (!fonteFilter.length) return 0;
    if (fonteFilter.includes(PAGAS_SENTINEL)) {
      const extras = fonteFilter.filter(f => f !== PAGAS_SENTINEL && !FONTES_PAGAS.includes(f));
      return 1 + extras.length; // "Fontes Pagas" counts as 1
    }
    return fonteFilter.length;
  })();

  const isActive = activeCount > 0;

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => { setPending(fonteFilter); setOpen(o => !o); }}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
          isActive
            ? 'bg-brand-blue text-white border-brand-blue shadow-sm'
            : 'bg-white text-gray-600 border-gray-200 hover:border-brand-blue/40 hover:text-brand-blue'
        }`}
      >
        <span>🔎</span>
        <span>Fonte</span>
        {isActive && (
          <span className={`px-1.5 py-0.5 rounded-md text-xs font-bold ${
            isActive ? 'bg-white/20 text-white' : 'bg-brand-blue/10 text-brand-blue'
          }`}>
            {activeCount}
          </span>
        )}
        <span className="opacity-60">{open ? '▲' : '▼'}</span>
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl p-4 w-[480px] max-h-[70vh] overflow-y-auto">
          {/* Fontes Pagas — special grouped option */}
          <button
            onClick={togglePagas}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-3 border transition-all text-left ${
              pagasSelected
                ? 'bg-brand-blue/10 border-brand-blue/30 text-brand-blue'
                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-brand-blue/5 hover:border-brand-blue/20'
            }`}
          >
            <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
              pagasSelected ? 'bg-brand-blue border-brand-blue' : 'border-gray-400'
            }`}>
              {pagasSelected && <span className="text-white text-xs leading-none">✓</span>}
            </span>
            <span className="font-bold text-sm">⚡ Fontes Pagas</span>
            <span className="text-xs text-gray-500 ml-auto">
              {FONTES_PAGAS.filter(f => allFontes.includes(f)).length} fontes
            </span>
          </button>

          {/* Separator */}
          <div className="border-t border-gray-100 mb-3" />

          {/* Individual fontes — 3-column grid */}
          {individualFontes.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5">
              {individualFontes.map(fonte => {
                const sel = isSelected(fonte);
                const isPaga = FONTES_PAGAS.includes(fonte);
                return (
                  <button
                    key={fonte}
                    onClick={() => toggleFonte(fonte)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs text-left transition-all ${
                      sel
                        ? 'bg-brand-blue/8 border-brand-blue/30 text-brand-blue'
                        : 'border-gray-100 text-gray-600 hover:bg-gray-50 hover:border-gray-200'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                      sel ? 'bg-brand-blue border-brand-blue' : 'border-gray-300'
                    }`}>
                      {sel && <span className="text-white text-xs leading-none" style={{ fontSize: '9px' }}>✓</span>}
                    </span>
                    <span className="truncate leading-tight">
                      {fonte}
                      {isPaga && <span className="ml-1 opacity-40 text-xs">⚡</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-xs text-center py-2">
              Nenhuma fonte disponível no período selecionado.
            </p>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <button
              onClick={clear}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-all"
            >
              Limpar tudo
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {pending.filter(f => f !== PAGAS_SENTINEL).length +
                  (pending.includes(PAGAS_SENTINEL) ? 1 : 0)} selecionada(s)
              </span>
              <button
                onClick={apply}
                className="px-4 py-1.5 bg-brand-blue text-white text-xs font-semibold rounded-lg hover:bg-brand-blue-mid transition-all"
              >
                Aplicar ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
