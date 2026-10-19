import { useState, useRef, useEffect, useMemo } from 'react';
import { FONTES_PAGAS } from '../../constants/index.js';

const PAGAS_SENTINEL = '__pagas__';
// How many fontes the list shows before "Ver todas as fontes"
const FONTES_VISIVEIS = 12;

// Checks if all paid fontes present in allFontes are selected
function isPagasSelected(fonteFilter, allFontes) {
  const pagasPresentes = FONTES_PAGAS.filter(f => allFontes.includes(f));
  if (!pagasPresentes.length) return false;
  if (fonteFilter.includes(PAGAS_SENTINEL)) return true;
  return pagasPresentes.every(f => fonteFilter.includes(f));
}

// Case- and accent-insensitive text for search ("importacao" finds "Importação")
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function FonteSelector({ allFontes = [], fontesInfo = [], fonteFilter = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(fonteFilter);
  const [busca, setBusca] = useState('');
  const [verTodas, setVerTodas] = useState(false);
  const ref = useRef(null);
  const buscaRef = useRef(null);

  // Sync pending when external filter changes (e.g. clear from parent)
  useEffect(() => { setPending(fonteFilter); }, [fonteFilter]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Fresh search box every time the popover opens
  useEffect(() => {
    if (!open) return;
    setBusca('');
    setVerTodas(false);
    buscaRef.current?.focus();
  }, [open]);

  const pagasSelected = useMemo(() => isPagasSelected(pending, allFontes), [pending, allFontes]);

  const buscando = busca.trim().length > 0;
  const lista = useMemo(() => {
    if (buscando) {
      const q = norm(busca.trim());
      return fontesInfo.filter(i => norm(i.fonte).includes(q));
    }
    return verTodas ? fontesInfo : fontesInfo.slice(0, FONTES_VISIVEIS);
  }, [fontesInfo, busca, buscando, verTodas]);
  const ocultas = fontesInfo.length - FONTES_VISIVEIS;

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
      if (isPaga && prev.includes(PAGAS_SENTINEL)) {
        // Unticking one paid fonte out of the "Fontes Pagas" group keeps the others
        return [
          ...prev.filter(f => f !== PAGAS_SENTINEL),
          ...FONTES_PAGAS.filter(f => f !== fonte && allFontes.includes(f)),
        ];
      }
      return [...prev.filter(f => f !== PAGAS_SENTINEL), fonte];
    });
  }

  function isSelected(fonte) {
    return pending.includes(fonte) || (FONTES_PAGAS.includes(fonte) && pending.includes(PAGAS_SENTINEL));
  }

  // Enter in the search box ticks the fonte when only one matches
  function onBuscaKey(e) {
    if (e.key === 'Enter' && buscando && lista.length === 1) {
      toggleFonte(lista[0].fonte);
      setBusca('');
    }
    if (e.key === 'Escape') {
      if (buscando) setBusca(''); else setOpen(false);
    }
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

  // Chips of what is ticked — so a selection hidden under "Ver todas" is never lost from view
  const chips = pending.includes(PAGAS_SENTINEL)
    ? [PAGAS_SENTINEL, ...pending.filter(f => f !== PAGAS_SENTINEL && !FONTES_PAGAS.includes(f))]
    : pending;

  function removeChip(f) {
    if (f === PAGAS_SENTINEL) togglePagas(); else toggleFonte(f);
  }

  // Index where the "no data in the period" group starts (fontesInfo is sorted active-first)
  const inicioSemDados = lista.findIndex(i => !i.noPeriodo);

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
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl w-[520px] max-w-[calc(100vw-32px)] max-h-[75vh] flex flex-col">
          <div className="p-4 pb-3">
            {/* Search */}
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
              <input
                ref={buscaRef}
                value={busca}
                onChange={e => setBusca(e.target.value)}
                onKeyDown={onBuscaKey}
                placeholder={`Pesquisar entre ${fontesInfo.length} fontes…`}
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/10"
              />
              {buscando && (
                <button
                  onClick={() => { setBusca(''); buscaRef.current?.focus(); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-xs"
                  title="Limpar pesquisa"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Fontes Pagas — special grouped option */}
            {!buscando && (
              <button
                onClick={togglePagas}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
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
            )}

            {/* Selected chips */}
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {chips.map(f => (
                  <span
                    key={f}
                    className="flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue text-xs font-medium"
                  >
                    {f === PAGAS_SENTINEL ? '⚡ Fontes Pagas' : f}
                    <button
                      onClick={() => removeChip(f)}
                      className="w-4 h-4 rounded-full hover:bg-brand-blue/20 leading-none"
                      title="Remover"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Individual fontes — scrollable list */}
          <div className="px-4 overflow-y-auto border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between mb-2 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
              <span>{buscando ? `${lista.length} resultado(s)` : 'Com dados no período'}</span>
              <span title="Leads criados no período do filtro 'Criado em' (SDR + Closer)">leads</span>
            </div>

            {lista.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {lista.map(({ fonte, leads, noPeriodo }, idx) => {
                  const sel = isSelected(fonte);
                  const isPaga = FONTES_PAGAS.includes(fonte);
                  return [
                    idx === inicioSemDados && (
                      <div key="__sem_dados__" className="sm:col-span-2 mt-2 mb-0.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                        Sem dados no período
                      </div>
                    ),
                    <button
                      key={fonte}
                      onClick={() => toggleFonte(fonte)}
                      title={fonte}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs text-left transition-all ${
                        sel
                          ? 'bg-brand-blue/8 border-brand-blue/30 text-brand-blue'
                          : noPeriodo
                            ? 'border-gray-100 text-gray-600 hover:bg-gray-50 hover:border-gray-200'
                            : 'border-gray-100 text-gray-400 hover:bg-gray-50 hover:border-gray-200'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                        sel ? 'bg-brand-blue border-brand-blue' : 'border-gray-300'
                      }`}>
                        {sel && <span className="text-white text-xs leading-none" style={{ fontSize: '9px' }}>✓</span>}
                      </span>
                      <span className="truncate leading-tight flex-1 min-w-0">{fonte}</span>
                      {isPaga && <span className="opacity-50 text-xs flex-shrink-0">⚡</span>}
                      <span className={`text-[11px] tabular-nums flex-shrink-0 ${sel ? 'text-brand-blue' : 'text-gray-400'}`}>
                        {noPeriodo ? leads : '—'}
                      </span>
                    </button>,
                  ];
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-xs text-center py-4">
                Nenhuma fonte encontrada para “{busca.trim()}”.
              </p>
            )}

            {/* Show all / show less */}
            {!buscando && ocultas > 0 && (
              <button
                onClick={() => setVerTodas(v => !v)}
                className="w-full mt-2 mb-1 py-2 rounded-lg text-xs font-semibold text-brand-blue hover:bg-brand-blue/5 transition-all"
              >
                {verTodas ? '▲ Mostrar menos' : `▼ Ver todas as fontes (+${ocultas})`}
              </button>
            )}
            <div className="h-3" />
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <button
              onClick={clear}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-all"
            >
              Limpar tudo
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {chips.length} selecionada(s)
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
