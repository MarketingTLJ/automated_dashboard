import { useState } from 'react';
import { DATA } from './data/data.js';
import { useDerivedData } from './hooks/useDerivedData.js';
import { Header } from './components/layout/Header.jsx';
import { Footer } from './components/layout/Footer.jsx';
import { Tab0_ResumoExecutivo }    from './tabs/Tab0_ResumoExecutivo.jsx';
import { Tab1_Receita }            from './tabs/Tab1_Receita.jsx';
import { Tab2_FunilComercial }     from './tabs/Tab2_FunilComercial.jsx';
import { Tab3_PerformanceClosers } from './tabs/Tab3_PerformanceClosers.jsx';
import { Tab4_AnaliseSdr }         from './tabs/Tab4_AnaliseSdr.jsx';
import { Tab5_PropostasPerdidas }  from './tabs/Tab5_PropostasPerdidas.jsx';
import { Tab6_Investimentos }      from './tabs/Tab6_Investimentos.jsx';
import { Tab7_Licencas }           from './tabs/Tab7_Licencas.jsx';

const ALL_MONTHS = DATA.map(d => d.ym);
const LAST       = ALL_MONTHS[ALL_MONTHS.length - 1];
const SIX_AGO    = ALL_MONTHS[Math.max(0, ALL_MONTHS.length - 6)];

export default function App() {
  const [activeTab, setActiveTab] = useState(0);

  // Criado em filter — default: last 6 months
  const [criadoStart, setCriadoStart] = useState(SIX_AGO);
  const [criadoEnd,   setCriadoEnd]   = useState(LAST);

  // Data de Término filter — default: this month only
  const [terminoStart, setTerminoStart] = useState(LAST);
  const [terminoEnd,   setTerminoEnd]   = useState(LAST);

  // Fonte filter — default: all sources (empty = no filter)
  const [fonteFilter, setFonteFilter] = useState([]);

  const {
    filtered, filteredTermino, CURR, PREV, N, trend, trend6, N6, last6,
    investRevenueVendas, investRevenueVendasInc,
    taxaGeralCurr, taxaGeralPrev, allMonths, isRange, allFontes,
  } = useDerivedData(criadoStart, criadoEnd, terminoStart, terminoEnd, fonteFilter);

  const tabProps = {
    CURR, PREV, trend, N, trend6, N6, last6,
    investRevenueVendas, investRevenueVendasInc,
    filtered, filteredTermino, isRange,
  };

  return (
    <div className="min-h-screen" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        criadoStart={criadoStart}
        criadoEnd={criadoEnd}
        onCriadoStartChange={setCriadoStart}
        onCriadoEndChange={setCriadoEnd}
        terminoStart={terminoStart}
        terminoEnd={terminoEnd}
        onTerminoStartChange={setTerminoStart}
        onTerminoEndChange={setTerminoEnd}
        allMonths={allMonths}
        currLabel={CURR?.label ?? '—'}
        allFontes={allFontes}
        fonteFilter={fonteFilter}
        onFonteFilterChange={setFonteFilter}
      />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 0 && (
          <Tab0_ResumoExecutivo {...tabProps}
            periodStart={criadoStart} periodEnd={criadoEnd}
            taxaGeralCurr={taxaGeralCurr} taxaGeralPrev={taxaGeralPrev}
          />
        )}
        {activeTab === 1 && <Tab1_Receita {...tabProps} />}
        {activeTab === 2 && <Tab2_FunilComercial {...tabProps} />}
        {activeTab === 3 && <Tab3_PerformanceClosers {...tabProps} />}
        {activeTab === 4 && <Tab4_AnaliseSdr {...tabProps} />}
        {activeTab === 5 && <Tab5_PropostasPerdidas {...tabProps} />}
        {activeTab === 6 && <Tab6_Investimentos {...tabProps} />}
        {activeTab === 7 && <Tab7_Licencas {...tabProps} />}
      </div>

      <Footer
        firstLabel={filtered[0]?.label ?? '—'}
        lastLabel={filtered[filtered.length - 1]?.label ?? '—'}
      />
    </div>
  );
}
