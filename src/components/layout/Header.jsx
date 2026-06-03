import { TABS } from '../../constants/index.js';
import { PeriodSelector } from './PeriodSelector.jsx';
import { FonteSelector } from './FonteSelector.jsx';

export function Header({
  activeTab, setActiveTab,
  criadoStart, criadoEnd, onCriadoStartChange, onCriadoEndChange,
  terminoStart, terminoEnd, onTerminoStartChange, onTerminoEndChange,
  currLabel,
  allFontes, fonteFilter, onFonteFilterChange,
}) {
  return (
    <div
      className="sticky top-0 z-50 border-b border-brand-blue/10"
      style={{ background: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
    >
      {/* Main nav row */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <img
            src="/logo-tlj.jpg"
            alt="Grupo TLJ"
            className="h-10 w-auto object-contain rounded-lg shadow-sm"
          />
          <div className="hidden md:block">
            <p className="font-bold text-brand-blue text-sm leading-none">Dashboard Comercial</p>
            <p className="text-brand-blue-light text-xs opacity-70 mt-0.5">{currLabel}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0.5 overflow-x-auto flex-1 justify-center px-2">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                activeTab === t.id
                  ? 'bg-brand-blue text-white font-bold shadow-sm'
                  : 'text-gray-500 hover:text-brand-blue hover:bg-brand-blue/8'
              }`}
            >
              <span className="hidden lg:inline">{t.label}</span>
              <span className="lg:hidden">{t.short}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Period selectors row — two independent filters */}
      <div className="max-w-7xl mx-auto px-4 pb-2.5 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">
          Filtrar por:
        </span>

        {/* Criado em filter */}
        <PeriodSelector
          mode="criado"
          start={criadoStart}
          end={criadoEnd}
          onStartChange={onCriadoStartChange}
          onEndChange={onCriadoEndChange}
        />

        <span className="text-gray-300 text-sm">&amp;</span>

        {/* Data de Término filter */}
        <PeriodSelector
          mode="termino"
          start={terminoStart}
          end={terminoEnd}
          onStartChange={onTerminoStartChange}
          onEndChange={onTerminoEndChange}
        />

        <span className="text-gray-300 text-sm">&amp;</span>

        {/* Fonte filter */}
        <FonteSelector
          allFontes={allFontes}
          fonteFilter={fonteFilter}
          onChange={onFonteFilterChange}
        />
      </div>
    </div>
  );
}
