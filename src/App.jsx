import { useState } from 'react';
import { ATUALIZADO_EM } from './data/data.js';
import { ALL_YMS, PARTIAL_YM } from './utils/months.js';
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

// Abre com "Criado em" e "Data de Término" no MÊS ATUAL (em andamento, "parcial") —
// decisão do usuário em 2026-10-19. Sem mês em andamento, cai no último mês disponível.
const INICIAL = PARTIAL_YM ?? ALL_YMS.at(-1);

export default function App() {
  const [activeTab, setActiveTab] = useState(0);

  // Criado em filter — default: mês atual
  const [criadoStart, setCriadoStart] = useState(INICIAL);
  const [criadoEnd,   setCriadoEnd]   = useState(INICIAL);

  // Data de Término filter — default: mês atual
  const [terminoStart, setTerminoStart] = useState(INICIAL);
  const [terminoEnd,   setTerminoEnd]   = useState(INICIAL);

  // Fonte filter — default: all sources (empty = no filter)
  const [fonteFilter, setFonteFilter] = useState([]);

  const {
    filtered, filteredTermino, CURR, PREV, N, trend, trend6, N6, last6, funil6, funilPeriodo,
    investRevenueVendas, investRevenueVendasInc,
    investRevenueVendasPrevYear, investRevenueVendasIncPrevYear,
    taxaGeralCurr, taxaGeralPrev, allMonths, isRange, allFontes, fontesInfo,
  } = useDerivedData(criadoStart, criadoEnd, terminoStart, terminoEnd, fonteFilter);

  const tabProps = {
    CURR, PREV, trend, N, trend6, N6, last6, funil6, funilPeriodo,
    investRevenueVendas, investRevenueVendasInc,
    investRevenueVendasPrevYear, investRevenueVendasIncPrevYear,
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
        currLabel={CURR ? `${CURR.label}${!isRange && CURR.parcial ? ' (parcial)' : ''}` : '—'}
        allFontes={allFontes}
        fontesInfo={fontesInfo}
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
        atualizadoEm={ATUALIZADO_EM}
      />
    </div>
  );
}
