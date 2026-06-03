# CLAUDE.md — Dashboard Comercial Grupo TLJ

> Fonte da Verdade para desenvolvimento do dashboard. Leia completamente antes de qualquer alteração.

---

## 1. VISÃO GERAL

Dashboard executivo mensal do **Grupo TLJ** que centraliza Receita, Marketing e Vendas.
App React (Vite) com atualização mensal via script Python.

**Stack:** Vite + React 18 + Recharts + Tailwind CSS (tokens TLJ) + Python/pandas  
**Usuários:** CEO/Diretoria (visão executiva) + Closers/SDRs/CS (visão operacional)

---

## 2. ESTRUTURA DO PROJETO

```
automated-reports/
├── CLAUDE.md              ← este arquivo
├── DESIGN.md              ← design system (tema claro)
├── package.json
├── tailwind.config.js     ← tokens: brand-blue, brand-red, brand-blue-light, surface-*
├── index.html             ← DM Sans Google Fonts, lang=pt-BR
├── scripts/
│   ├── extract.py         ← ÚNICA fonte de data.js — nunca editar data.js à mão
│   ├── inspect_excel.py   ← diagnóstico de estrutura dos arquivos Excel
│   └── inspect2.py        ← validação de cálculos por mês
├── src/
│   ├── App.jsx            ← estado global: 4 filtros de data + activeTab
│   ├── constants/index.js ← COLORS, THR, TABS, ALERT_THR, ROI_TARGET, CHART_OPACITY, THR_PERDA_SDR
│   ├── data/data.js       ← GERADO pelo Python
│   ├── hooks/useDerivedData.js  ← toda a lógica de agregação e CURR/PREV
│   ├── utils/
│   │   ├── formatters.js  ← fmt, fmtK, pct, dp, scl, sclCls
│   │   ├── alertEngine.js ← geração de alertas diagnósticos
│   │   └── respToArray.js ← closerRespToArr, sdrRespToArr (transforma objetos em arrays)
│   ├── components/
│   │   ├── ui/            ← KpiCard, DeltaBadge, MotifBars, StatusBadge, AlertBanner, ChartTooltip, SectionHeader
│   │   ├── layout/        ← Header, PeriodSelector, Footer
│   │   └── charts/        ← RevenueStackedBar, ConversionRateBar, FunnelBars, WinLossBar, RoiCplComposed
│   └── tabs/              ← Tab0_ResumoExecutivo … Tab6_Investimentos
└── Reports/               ← arquivos Excel (não versionados)
```

---

## 3. MAPEAMENTO DE DADOS (verificado 2026-06-01)

### 3.1 BASE SDR
Arquivo: `BASE SDR - MODIFICADO 2025 a 01.06.25.xlsx`

| Campo | Coluna | Nota |
|-------|--------|------|
| Data criação | `Criado` (idx 22) | ⚠️ NÃO `Criado1` — renomeado |
| Fase | `Fase` | Ver fases abaixo |
| Responsável | `Responsável` | |
| Fonte | `Fonte` | Google Ads, WhatsApp, etc. |
| Motivo perda | `[SDR] Motivo de perda` | |

**Fases tratadas como Perdido:**
```python
FASES_PERDIDO_SDR = {'Perdido', 'Nutrição', 'Base de Oportunidade - Nutrição', 'Parar promocoes'}
```

### 3.2 BASE CLOSER
Arquivo: `BASE CLOSER - MODIFICADO 2025 a 01.06.25.xlsx`

| Campo | Coluna | Nota |
|-------|--------|------|
| Data criação | `Criado` (idx 22) | ⚠️ NÃO `Criado1` |
| Data fechamento | `Data de fechamento` (idx 27) | ⚠️ NÃO `iloc[:,29]` |
| Fase | `Fase` | `Ganho`, `Perdido`, resto = Em Aberto |
| SDR origem | `#TLJ# SDR` | |
| Valor | `Renda` | |
| Motivo perda | `[SDR] Motivo de perda` | |

### 3.3 BASE RENTABILIZAÇÃO
Arquivo: `BASE RENTABILIZAÇÂO COMPLETA - 01.06.2026.xlsx`

| Campo | Coluna | Nota |
|-------|--------|------|
| Data ganho | `Data da mudança de etapa` | Usar quando `Fase='8 - Ganho'` |
| Data fechamento | `Data de fechamento` | Planejada (não é data do ganho) |
| Fase ganho | `Fase = '8 - Ganho'` | ⚠️ NÃO `Tipo='Incremento'` — estrutura mudou |
| Valor | `Renda` | ⚠️ NÃO `Valor` — campo renomeado |
| É renovação | `É renovação?` == `Sim` | Distingue renovação de incremento |
| Fonte (VLOOKUP) | `Empresa` → Closer.`Empresa` → Closer.`Fonte` | ⚠️ Campo NÃO existe no arquivo — gerado via VLOOKUP automático em `extract.py` |

**VLOOKUP Rentabilização → Fonte:**
O `extract.py` busca a `Fonte` de cada negócio de Rentabilização pelo campo `Empresa`:
1. Para cada registro em Rentabilização, busca `Empresa` no pipeline Closer
2. Prioriza deals com `Fase='Ganho'`; fallback: qualquer deal da empresa
3. Atribui `Fonte` do Closer ao registro de Rentabilização
4. Registros sem match recebem `'Não identificado'`

> ⚠️ **BREAKING CHANGE vs docs antigas:** `Tipo` não tem mais `Incremento/Renovação`.
> Usar `Fase='8 - Ganho'` + `É renovação?` para segmentar.

### 3.4 INVESTIMENTOS
Arquivo: `INVESTIMENTOS.xlsx`

- Linha 5 (índice) = `Total Investido Mês`
- Colunas: `'jan/25', 'fev/25', ..., 'mai/26'`
- `abr/26` está ausente (inv=0 para Abr/26)

---

## 4. REGRAS DE NEGÓCIO CRÍTICAS

⚠️ NUNCA alterar sem confirmação explícita do usuário.

### Regra Universal (todos os pipelines)
- **Volume/Propostas**: IDs com `Criado` no mês
- **Ganhos/Perdidos do mês**: filtro por `Data de fechamento` + Fase=Ganho/Perdido

| Métrica | Filtro | Fórmula |
|---------|--------|---------|
| Total Leads | `Criado` no mês | SDR criados + Closer criados |
| Reuniões | `Criado` no mês | = `leads_closer` |
| Qtd Vendas (qtd_v) | `Data de fechamento` + Fase=Ganho | Closer |
| Receita Novas Vendas (rec_v) | `Data de fechamento` + Fase=Ganho | Closer `Renda` |
| Qtd Incrementos (qtd_i) | `Data de fechamento` + Fase=8-Ganho | Rentabilização |
| Receita Incrementos (rec_i) | `Data de fechamento` + Fase=8-Ganho | Rentabilização `Renda` |
| Ganho/Perdido pipeline health | `Criado` no mês | para taxa_fech e análise de funil |
| Taxa Conv. Geral | — | `qtd_v / leads_total × 100` |
| Taxa Fech. Closer | — | `ganho / (ganho + perdido) × 100` (por criação, exclui Em Aberto) |
| ROI **Líquido** | — | `(rec_v - inv) / inv` ← Net ROI (lucro bruto / investimento) |
| Lucro Bruto | — | `rec_v - inv` |
| CAC | — | `inv / qtd_v` |
| CPL | — | `inv / (leads_sdr + leads_closer)` |
| PP (Propostas Perdidas) | `Data de fechamento` + Fase=Perdido | Closer |
| Meta ROI | — | `ROI_TARGET = 15x` (constante em `constants/index.js`) |

> **Incrementos = Novas Vendas de Rentabilização** (vendas para clientes da carteira).
> ROI = **Net ROI** = (Faturamento - Investimento) / Investimento. Não usar faturamento bruto / investimento.

---

## 5. ATUALIZAÇÃO MENSAL

```
[ ] 1. Receber Excel atualizados em Reports/
[ ] 2. python scripts/extract.py
[ ] 3. Validar números-chave no output:
        - Total leads do mês
        - Ganhos e receita novas vendas
        - PP total e valor
        - Investimento total
[ ] 4. Abrir npm run dev e verificar visualmente as 7 abas
[ ] 5. Commit: "data: add MMM/26"
```

---

## 6. ARQUITETURA — REGRAS

- `data.js` é gerado automaticamente — **nunca editar à mão**
- `CURR` e `PREV` vêm sempre do hook `useDerivedData`, não de constantes globais
- `isRange` vem do hook via `tabProps` — **nunca recalcular localmente nos tabs**
- Todo business logic vai em `utils/` ou `hooks/`, nunca em arquivos de aba
- Toda cor vai em `constants/index.js`, nunca hardcoded nos componentes
- Toda constante numérica com significado de negócio vai em `constants/index.js`
- Tailwind: usar apenas tokens customizados do `tailwind.config.js` (brand-blue, surface-card, etc.)
- Recharts é a única biblioteca de gráficos permitida
- Transformações de `closer_resp`/`sdr_resp` → usar `closerRespToArr`/`sdrRespToArr` de `utils/respToArray.js`

---

## 7. ARQUITETURA DE FILTROS DE DATA (dual filter)

O App possui **dois filtros de data independentes**, controlados pelo `Header`:

```
Criado em: [start ←→ end]       ← controla DATA (leads por data de criação)
Data de Término: [start ←→ end] ← controla DATA_TERMINO (vendas por data de fechamento)
```

### Estados em App.jsx
```js
const [criadoStart, setCriadoStart]   = useState(SIX_AGO);  // default: -6 meses
const [criadoEnd,   setCriadoEnd]     = useState(LAST);
const [terminoStart, setTerminoStart] = useState(LAST);      // default: mês atual
const [terminoEnd,   setTerminoEnd]   = useState(LAST);
```

### Hook useDerivedData(criadoStart, criadoEnd, terminoStart, terminoEnd, fonteFilter)

**Retorna:**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `filtered` | Array | DATA filtrado por criado range (lead metrics) |
| `filteredTermino` | Array | DATA_TERMINO filtrado por termino range (win/revenue metrics) |
| `CURR` | Object | Mês atual OU agregado de período (ver isRange) |
| `PREV` | Object\|null | Mês anterior (null quando isRange=true) |
| `N` | number | Índice de CURR no array trend (para opacity de charts) |
| `trend` | Array | Dados mensais de `filtered` para gráficos |
| `isRange` | boolean | `filtered.length > 1` |
| `taxaGeralCurr` | number | Taxa conv. geral de CURR |
| `taxaGeralPrev` | number | Taxa conv. geral de PREV |
| `allMonths` | Array | Todos os YMs disponíveis |
| `allFontes` | Array | Fontes disponíveis no período selecionado (para UI do FonteSelector) |

### tabProps (App.jsx → tabs)

```js
const tabProps = { CURR, PREV, trend, N, filtered, filteredTermino, isRange };
```

Tabs recebem `isRange` via props — nunca recalcular localmente.

### Comportamento de CURR

**Mês único (`isRange = false`):**
- `CURR` = blend de `DATA[criadoEnd]` + `DATA_TERMINO[terminoEnd]`
- Lead metrics (leads_total, ganho, perdido, sdr_resp, etc.) vêm de `DATA` (criado)
- Win/revenue metrics (qtd_v, rec_v, pp, vendas_resp, etc.) vêm de `DATA_TERMINO` (termino)
- `PREV` = blend do mês anterior de ambas as fontes

**Período múltiplo (`isRange = true`):**
- `CURR` = `buildPeriodCurr(filtered, filteredTermino, label)` — **agregado do período completo**
- `PREV = null` — sem comparação mês-a-mês em modo de período
- `CURR.label` = `"Jan/26 → Jun/26"` (range label)

### Semântica por campo em CURR agregado

| Campo | Fonte | Razão |
|-------|-------|-------|
| `leads_total`, `leads_sdr`, `leads_closer`, `reunioes` | `filtered` (DATA criado) | Leads são por data de criação |
| `ganho`, `perdido`, `aberto`, `taxa_fech` | `filtered` | Funil "por criação" (regra de negócio) |
| `sdr_resp`, `sdr_mp_resp`, `fonte_sdr`, `mp_sdr` | `filtered` | SDR metrics por criação |
| `closer_resp` | `filtered` | Pipeline view por criação (funil) |
| `qtd_v`, `rec_v`, `qtd_i`, `rec_i`, `qtd_r`, `rec_r` | `filteredTermino` | Vendas por data de fechamento |
| `inv`, `roi`, `cac`, `cpl`, `lucro_bruto` | `filteredTermino` | Investimento e ROI por período de término |
| `pp`, `vendas_resp`, `closer_mp_resp`, `mp_closer` | `filteredTermino` | Revenue/perdas por fechamento |

---

## 8. VALIDAÇÕES OBRIGATÓRIAS

```
OK Total Leads = SDR criados + Closer criados no mês (campo Criado)
OK Reuniões = exatamente o total de Closer criados (campo Criado)
OK Qtd Vendas = Closer com dt_fech no mês E Fase=Ganho
OK Taxa Conv. Geral = Contratos (por fechamento) ÷ Total Leads (por criação)
OK Taxa Fech. Closer = Ganhos ÷ (Ganhos + Perdidos) por criação — exclui Em Aberto
OK SDR Taxa Conv. = via col #TLJ# SDR no Closer
OK PP = Fase=Perdido + Data de Fechamento no mês
OK ROI = (Novas Vendas - Investimento) ÷ Investimento  ← Net ROI, NÃO bruto
OK CURR = buildPeriodCurr quando isRange, blend single-month quando !isRange
OK PREV = penúltimo mês blended (null se isRange ou período insuficiente)
OK isRange = calculado no hook, propagado via tabProps — não recalcular nos tabs
```

**Valores de referência Jan–Mar/26:**
- Jan/26: leads≈188, qtd_v=9, rec_v=R$91.663, roi=11.9x
- Fev/26: leads≈223, qtd_v=7, rec_v=R$98.942, roi=12.1x
- Mar/26: leads=228, qtd_v=4, rec_v=R$67.022, roi=4.1x

---

## 9. CONSTANTES DE NEGÓCIO (constants/index.js)

| Constante | Valor | Uso |
|-----------|-------|-----|
| `ROI_TARGET` | `15` | Meta de ROI — linha de referência em gráficos e textos de alerta |
| `CHART_OPACITY` | `{ active: 1, past: 0.45 }` | Opacidade de barras: mês atual vs anteriores |
| `THR_PERDA_SDR` | `{ critical: 85, warn: 70 }` | Thresholds de taxa de perda SDR (Tab4) |
| `ALERT_THR.roiCritical` | `8` | ROI < 8x dispara alerta vermelho |
| `THR.roi` | `[15, 10]` | Semáforo de cor para ROI (verde/âmbar/vermelho) |
| `FONTES_PAGAS` | Array | Fontes pagas — fonte da verdade: `Reports/FontesPagas.xlsx` (coluna "Fonte Paga?"="Sim"). Sincronizar com `extract.py` ao atualizar o Excel. |

---

## 10. PADRÕES DE CÓDIGO

### Adicionando novo card/KPI
1. Calcule o valor em `useDerivedData.js` (ou em `buildPeriodCurr` para modo período)
2. Exponha via `CURR.nome_campo`
3. Use `KpiCard` ou pattern direto no tab
4. Se threshold de cor: adicionar em `THR` ou `ALERT_THR` em `constants/index.js`

### Adicionando novo gráfico
1. Crie em `src/components/charts/`
2. Use `COLORS` de `constants/index.js` para cores
3. Use `CHART_OPACITY.active`/`CHART_OPACITY.past` para opacidade das barras
4. Use `ChartTooltip` para tooltip uniforme
5. Aceite props `data`, `N`, `height`

### Adicionando nova aba
1. Crie `src/tabs/TabN_Nome.jsx`
2. Aceite `{ CURR, PREV, trend, N, filtered, filteredTermino, isRange }` via `tabProps`
3. Adicione `{ id: N, label: '...', short: '...' }` em `TABS` (constants/index.js)
4. Importe e renderize em `App.jsx`

---

## 11. ROADMAP

### Próximo: Integração Bitrix24 via MCP
```
Fluxo futuro:
1. scripts/extract_bitrix.py conecta ao Bitrix24 via MCP
2. Produz MESMO formato de saída que extract.py
3. src/data/data.js permanece idêntico — nenhum componente muda
4. constants/index.js: DATA_SOURCE = 'bitrix24'

Endpoints Bitrix24:
- crm.deal.list  → negócios
- crm.category.list → pipelines (SDR/Closer/Rentabilização)
- user.get       → responsáveis
```

---

---

## 12. FILTRO DE FONTE

### Componentes
- `src/components/layout/FonteSelector.jsx` — popover multi-select com grid 3 colunas
- `src/constants/index.js` → `FONTES_PAGAS` — lista das fontes pagas
- `Reports/FontesPagas.xlsx` — fonte da verdade (coluna "Fonte Paga?"="Sim")

### Fluxo
```
App.jsx [fonteFilter: string[]] 
  → useDerivedData(..., fonteFilter)        ← novo 5º parâmetro
    → applyFonteFilter(monthRecord, fontes) ← recalcula métricas por fonte
  → Header → FonteSelector
```

### Sentinela `__pagas__`
Quando o usuário seleciona "Fontes Pagas", o array inclui `'__pagas__'`.
`expandFontes()` no hook expande esse sentinela para todos os nomes em `FONTES_PAGAS`.

### Escopo V1 (o que é filtrado)
- `leads_sdr`, `leads_closer`, `leads_total`
- `qtd_v`, `rec_v`, `qtd_i`, `rec_i`, `qtd_r`, `rec_r`
- Derivados: `ticket`, `roi`, `cac`, `cpl`, `lucro_bruto`
- `fonte_sdr` (distribuição por fonte no Tab4)

### Escopo V1 (o que NÃO é filtrado — permanece total)
- `ganho`, `perdido`, `aberto`, `taxa_fech` (não quebrados por fonte)
- `closer_resp`, `sdr_resp`, `pp` (estruturas complexas)
- `inv` (investimento não é rastreado por fonte)

### Atualização de fontes pagas
1. Editar `Reports/FontesPagas.xlsx` (coluna "Fonte Paga?")
2. Rodar `python scripts/extract.py`
3. Atualizar manualmente `FONTES_PAGAS` em `src/constants/index.js` para manter sincronizado

---

*Última atualização: Jun/2026 | v4.1 — Filtro de Fonte (VLOOKUP + multi-select)*
