# CLAUDE.md — Dashboard Comercial Grupo TLJ

> Fonte da Verdade para desenvolvimento do dashboard. Leia completamente antes de qualquer alteração.

---

## 1. VISÃO GERAL

Dashboard executivo do **Grupo TLJ** que centraliza Receita, Marketing e Vendas.
App React (Vite) com **atualização automática diária às 06:00** — dados do CRM direto do
Bitrix24 via webhook (§15). A única entrada manual é a planilha `Reports/INVESTIMENTOS.xlsx`.

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
├── logs/                  ← auto_update.log + estado.json (gitignored)
├── scripts/
│   ├── extract.py         ← ÚNICA fonte de data.js — nunca editar data.js à mão (--source bitrix|excel)
│   ├── bitrix_source.py   ← lê os 4 pipelines do Bitrix24 (somente leitura) — §15
│   ├── bitrix_users.json  ← ID do Bitrix → nome da pessoa (§15.4)
│   ├── auto_update.py     ← rotina diária: extrai → trava → build → commit/push → deploy
│   ├── registrar_agendamento.ps1 ← cria a tarefa das 06:00 no Agendador do Windows
│   ├── inspect_excel.py   ← diagnóstico de estrutura dos arquivos Excel
│   └── inspect2.py        ← validação de cálculos por mês
├── src/
│   ├── App.jsx            ← estado global: 4 filtros de data + activeTab
│   ├── constants/index.js ← COLORS, THR, TABS, ALERT_THR, ROI_TARGET, CHART_OPACITY, THR_PERDA_SDR
│   ├── data/data.js       ← GERADO pelo Python
│   ├── hooks/useDerivedData.js  ← toda a lógica de agregação e CURR/PREV
│   ├── utils/
│   │   ├── months.js      ← LAST_CLOSED, PARTIAL_YM, anyInvPendente (mês em andamento — §15.7)
│   │   ├── formatters.js  ← fmt, fmtK, pct, dp, scl, sclCls
│   │   ├── alertEngine.js ← geração de alertas diagnósticos
│   │   └── respToArray.js ← closerRespToArr, sdrRespToArr (transforma objetos em arrays)
│   ├── components/
│   │   ├── ui/            ← KpiCard, DeltaBadge, MotifBars, StatusBadge, AlertBanner, ChartTooltip, SectionHeader
│   │   ├── layout/        ← Header, PeriodSelector, Footer
│   │   └── charts/        ← RevenueStackedBar, ConversionRateBar, FunnelBars, WinLossBar, RoiCplComposed
│   └── tabs/              ← Tab0_ResumoExecutivo … Tab6_Investimentos
└── Reports/               ← INVESTIMENTOS.xlsx, FontesPagas.xlsx (+ exportações antigas, backup) — não versionados
```

---

## 3. MAPEAMENTO DE DADOS (verificado 2026-06-01)

> Desde 2026-09-30 os dados do CRM vêm da **API do Bitrix24** (§15), que reproduz exatamente
> as colunas abaixo. As planilhas exportadas viraram **backup** (`extract.py --source excel`).
> As regras de fase/motivo desta seção valem igual para as duas fontes.

### 3.1 BASE SDR
Arquivo: `BASE SDR - MODIFICADO 2025 a 01.06.25.xlsx`

| Campo | Coluna | Nota |
|-------|--------|------|
| Data criação | `Criado` (idx 22) | ⚠️ NÃO `Criado1` — renomeado |
| Fase | `Fase` | Ver fases abaixo |
| Responsável | `Responsável` | |
| Fonte | `Fonte` | Google Ads, WhatsApp, etc. |
| Motivo perda | `[SDR] Motivo de perda` | |

**Fases tratadas como Perdido** (revisado 2026-08-03):
```python
FASES_PERDIDO_SDR = {
    'Perdido - sem reunião',        # fase atual de perda sem reunião
    'Reunião realizada- Perdido',   # perda após reunião (grafia do Bitrix: sem espaço antes do hífen)
    'Base de Oportunidade - Nutrição',
    'Parar promocoes',
    'Queria suporte',               # lead de suporte, não é oportunidade
    'Perdido',                      # legado 2025
    'Nutrição',                     # legado 2025 (0 registros hoje)
}
```

> ⚠️ **Os nomes das etapas do Bitrix mudam.** `'Perdido'` foi renomeado para
> `'Perdido - sem reunião'` e o set antigo deixou 2.772 leads perdidos fora da conta
> (Jul/26 mostrava 15 em vez de 102). **Sempre que uma etapa for criada/renomeada no
> pipeline SDR, revalidar esta lista** rodando `scripts/inspect_excel.py` e conferindo
> `df['Fase'].value_counts()` contra o set.

**Fases NÃO consideradas perdido** (ficam em `sdr_ativo`): `Entrada`, `Em conexão`/`Em Conexão`,
`Conectado - Em atendimento`, `Pré Qualificado`, `Qualificado`, `Oportunidade Ouro`,
`Oportunidade Diamante`, `Reunião agendada`, `Reagendado` (nova em 2026-09), `No-Show`.
`Reunião Realizada` é excluída tanto de `sdr_ativo` quanto de `sdr_perdido` (lead avançou).

> 🧹 **Sujeira de dados conhecida:** o pipeline tem `Em conexão` (26) e `Em Conexão` (21)
> como etapas distintas — mesma etapa, caixa diferente. Não afeta perdidos (ambas são ativas),
> mas convém unificar no Bitrix.

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
| Fase ganho | `Fase ∈ FASES_GANHO_RENT` | `'8 - Venda Paga'` (atual) + `'8 - Ganho'` (legado). ⚠️ NÃO `Tipo='Incremento'` — estrutura mudou |
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
> Usar `Fase ∈ FASES_GANHO_RENT` + `É renovação?` para segmentar.

> ⚠️ **Rename 2026-09-30:** o Bitrix renomeou `'8 - Ganho'` → `'8 - Venda Paga'` (retroativo —
> nenhum registro com a grafia antiga). Com o filtro antigo, `qtd_i`/`rec_i` teriam zerado em
> todos os meses **sem erro**. Validado: `8 - Venda Paga` reproduz exatamente os incrementos
> Mai/25–Ago/26 do extract anterior. A grafia antiga segue no set por retrocompatibilidade.

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
| **Leads Efetivos** | `Criado` no mês | `leads_total − leads_descartados` — ver §14 |
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
| CPL | **sempre por `Criado`** | `inv / leads_total` — investimento e leads do MESMO período de criação |
| PP (Propostas Perdidas) | `Data de fechamento` + Fase=Perdido | Closer |
| Meta ROI | — | `ROI_TARGET = 15x` (constante em `constants/index.js`) |

> **Incrementos = Novas Vendas de Rentabilização** (vendas para clientes da carteira).
> ROI = **Net ROI** = (Faturamento - Investimento) / Investimento. Não usar faturamento bruto / investimento.
>
> ⚠️ **CPL não olha Data de Término.** É o investimento do período dividido pelos leads
> **criados** nesse mesmo período. Por isso `cpl` **não** entra em `WIN_FIELDS` e, em modo
> período, usa `sumKey(filtered, 'inv')` — nunca o `inv` do término. ROI, CAC e Lucro Bruto
> continuam no término, porque receita é por data de fechamento.

---

## 5. ATUALIZAÇÃO — ROTINA (automática desde 2026-09-30)

### Diária — automática, ninguém precisa fazer nada
Todo dia às **06:00** a tarefa `TLJ Dashboard - Atualizacao diaria` do Agendador do Windows
(neste PC) roda `scripts/auto_update.py`: Bitrix24 + INVESTIMENTOS.xlsx → `data.js` → travas
de segurança → `npm run build` → commit **só do data.js** → push → Deploy Hook. Detalhes em §15.8.

### Mensal — a única tarefa manual do usuário
```
[ ] Depois que o mês fecha: acrescentar a coluna do mês em Reports/INVESTIMENTOS.xlsx
    (cabeçalho 'mmm/aa' minúsculo, ex: 'out/26'; mesmo formato das colunas anteriores).
    A próxima execução das 06:00 publica sozinha. Até lá, o mês aparece como
    "Aguardando investimento" (ROI/CAC/CPL/Lucro) — não como ROI 0x.
[ ] Se uma fonte paga mudar: editar Reports/FontesPagas.xlsx e sincronizar FONTES_PAGAS
    em src/constants/index.js (§12)
```

### Quando o Claude for chamado para "atualizar o relatório" / investigar
```
[ ] 1. Ler logs/auto_update.log (última execução e motivo de falha, se houver)
[ ] 2. Rodar na hora: python scripts/auto_update.py      (ou --dry-run para testar sem publicar)
[ ] 3. Se falhar por SchemaError (fase/motivo renomeado no Bitrix): revisar FASES_* /
        MOTIVOS_NAO_EFETIVOS em extract.py com o usuário — NUNCA publicar sem confirmar
        (já aconteceu 3x: 'Ganho'→'Venda - Ganho' no Closer, perdas do SDR, e
        '8 - Ganho'→'8 - Venda Paga' na Rentabilização — ver §3.1/§3.2/§3.3)
[ ] 4. Se INVESTIMENTOS.xlsx der erro: conferir cabeçalho 'mmm/aa' minúsculo
[ ] 5. Conferir https://automated-dashboard.vercel.app (Ctrl+F5) — rodapé mostra
        "Dados atualizados em dd/mm/aaaa às hh:mm"
```

### Backup — exportação manual de planilhas (só se o webhook parar)
Colocar as 4 exportações em `Reports/` (o script pega a mais recente de cada padrão) e rodar
`python scripts/extract.py --source excel`, depois build/commit/deploy como em §13.

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
| `inv`, `roi`, `cac`, `lucro_bruto` | `filteredTermino` | Investimento e ROI por período de término |
| `cpl` | **`filtered`** (criado) | Investimento ÷ leads criados — ambos do período de criação |
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
OK sdr_perdido = leads SDR criados no mês cuja Fase está em FASES_PERDIDO_SDR
OK sdr_perdido + sdr_ativo + (Fase='Reunião Realizada') = leads_sdr  ← conferir a cada extract
OK CPL = investimento ÷ leads criados, AMBOS do período de criação — ignora Data de Término
```

**Referência SDR Jul/26** — snapshot de 2026-08-03, validado contra pivot do Bitrix:
- leads_sdr=150 · sdr_perdido=**103** · sdr_ativo=47
- Composição: `Perdido - sem reunião` 87 + `Base de Oportunidade - Nutrição` 14 + `Parar promocoes` 1 + `Queria suporte` 1

> ⚠️ **Esses números mudam a cada extract e isso é esperado** — não é regressão.
> Conforme os leads são trabalhados, `sdr_ativo` migra para `sdr_perdido` (ou para
> `Reunião Realizada`), e o Bitrix também sofre limpezas retroativas. No update de
> 2026-08-10 o mesmo Jul/26 passou a `leads_sdr=145 · sdr_perdido=128 · sdr_ativo=17`.
> Safras antigas convergem para `sdr_ativo=0`. **Valide sempre a coerência interna**
> (§8) em vez de comparar com números absolutos de extracts anteriores.

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
| `THR_PERDA_SDR` | `{ critical: 95, warn: 85 }` | Thresholds de taxa de perda SDR (Tab4) — recalibrado 2026-08-03 sobre a distribuição real |
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

### ✅ Integração Bitrix24 via Webhook REST — em produção desde 2026-09-30 (§15)

### Possíveis próximos passos (não iniciar sem pedido do usuário)
- Pipelines extras (Inner WhatsApp, Outbound PAP, Low-Ticket) — usuário decidiu deixar fora
- Rodar a automação na nuvem (hoje depende do PC ligado/logado — §15.6)

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

### Escopo V3 (o que é filtrado) — atualizado 2026-08-29
- `leads_sdr`, `leads_closer`, `leads_total`, `reunioes`
- `qtd_v`, `rec_v`, `qtd_i`, `rec_i`, `qtd_r`, `rec_r`
- Derivados: `ticket`, `roi`, `cac`, `cpl`, `lucro_bruto`
- `fonte_sdr` (distribuição por fonte no Tab4)
- **Aba Análise SDR completa (V2):** `sdr_ativo`, `sdr_perdido`,
  `leads_efetivos`, `leads_descartados`, `sdr_resp` (tabela por responsável),
  `sdr_mp_resp` (drill-down de motivos) e `mp_sdr` (motivos gerais)
- **Aba Funil Comercial completa (V3):** `ganho`, `perdido`, `aberto`, `taxa_fech`
  (pipeline health do Closer por criação) e os 4 cards de valor —
  `valor_total_prop` (Valor em Oportunidade), `valor_aberto_prop` (Valor em
  Andamento), `valor_perdido_prop` (Valor Perdido), `valor_ganho_prop`
  (não exibido — `rec_v`/Data de Fechamento é quem alimenta o card "Valor Ganho")

### O que ainda NÃO é filtrado (permanece total)
- `closer_resp`, `vendas_resp`, `pp` (abas Closers e Propostas Perdidas)
- `inv` (investimento não é rastreado por fonte)

> ⚠️ **Ao adicionar um KPI que deve responder ao filtro**, não basta criar o campo no
> `build_month`: é preciso (1) gerar a métrica por fonte em `_build_por_fonte` e
> (2) somá-la em `applyFonteFilter`. Se esquecer, o card fica **congelado no total**
> enquanto o denominador filtra — produzindo percentuais acima de 100%, sem erro visível.
> Foi exatamente o que aconteceu com `leads_efetivos` (185% dos leads gerados).

### Teste de sanidade do filtro
Somar **todas** as fontes de `por_fonte` tem de reproduzir exatamente os totais do mês.
Se divergir, o breakdown está perdendo ou duplicando registros:

```
Σ por_fonte[f].leads_sdr   == leads_sdr
Σ por_fonte[f].sdr_perdido == sdr_perdido
Σ por_fonte[f].descartados == leads_descartados
Σ por_fonte[f].sdr_resp[nome].total == sdr_resp[nome].total
```

### Atualização de fontes pagas
1. Editar `Reports/FontesPagas.xlsx` (coluna "Fonte Paga?")
2. Rodar `python scripts/extract.py`
3. Atualizar manualmente `FONTES_PAGAS` em `src/constants/index.js` para manter sincronizado

---

## 13. DEPLOY

> A atualização diária (§5, §15.8) já faz todo este fluxo sozinha para o `data.js`.
> O fluxo manual abaixo vale para **mudanças de código** feitas numa sessão com o Claude.

### Fluxo completo (manual)
```
1. python scripts/extract.py     ← gera novo data.js (Bitrix24)
2. npm run build                 ← valida que compila sem erros
3. git add <arquivos relevantes> ← nunca `git add -A`
4. git commit -m "..."
5. git push origin main
6. Disparar deploy manual (ver "Deploy Hook" abaixo)
7. Aguardar 1-3 min, conferir https://automated-dashboard.vercel.app (Ctrl+F5)
```

### ⚠️ Por que o deploy é manual
O projeto está conectado ao Vercel via integração Git
(`github.com/MarketingTLJ/automated_dashboard` → projeto `automated-dashboard` no
Vercel), que **deveria** disparar deploy automático a cada push em `main`. Essa
integração **não está disparando de forma confiável** — verificado em 2026-07:
pushes para `main` não geravam nenhuma entrada nova na aba "Deployments" do Vercel
(o site continuava servindo um commit antigo). Causa raiz não diagnosticada até
o momento (suspeita: webhook GitHub→Vercel quebrado ou desconectado — ver
"Resolver a causa raiz" abaixo). **Até isso ser corrigido, todo deploy precisa ser
disparado manualmente via Deploy Hook.**

### Deploy Hook (mecanismo manual atual)
Existe um **Vercel Deploy Hook** já criado (Vercel → Settings → Git → Deploy Hooks,
branch `main`) — uma URL que, ao receber um `POST`, dispara build+deploy do commit
mais recente de `main`, sem depender do webhook automático.

- A URL vive em `.env.local` na raiz do projeto (`VERCEL_DEPLOY_HOOK_URL=...`).
- **Nunca commitar essa URL** em CLAUDE.md, código, ou qualquer arquivo versionado —
  o repositório é **público**; a URL funciona como uma senha (qualquer pessoa com
  ela pode disparar deploys no projeto).
- Se `.env.local` não existir na sessão atual (ex: outra máquina, outro chat), peça
  a URL ao usuário ou oriente-o a gerar uma nova: Vercel → Settings → Git → Deploy
  Hooks → Name: qualquer nome → Branch: `main` → Create Hook.
- Para disparar (depois do `git push`):
  ```bash
  curl -X POST "$VERCEL_DEPLOY_HOOK_URL"
  ```
  Resposta esperada: HTTP 201 com `{"job":{"id":"...","state":"PENDING",...}}`.
  Isso confirma que o job de build foi enfileirado — não que o deploy já terminou.

### Links de referência
- Produção: https://automated-dashboard.vercel.app
- Repositório: https://github.com/MarketingTLJ/automated_dashboard
- Painel Vercel: https://vercel.com/grupo-tlj-s-projects/automated-dashboard

### Resolver a causa raiz (pendente — faria o Deploy Hook desnecessário)
1. Vercel → Settings → Git → "Disconnect", depois "Connect Git Repository"
   novamente selecionando `automated_dashboard` / branch `main`
2. OU no GitHub: repo → Settings → Webhooks → conferir se existe webhook para
   `api.vercel.com` e se as "Recent Deliveries" mais recentes retornam sucesso
3. Depois de corrigir, testar com um commit trivial e confirmar que aparece
   sozinho em Vercel → Deployments antes de voltar a confiar no auto-deploy

---

---

## 14. LEADS EFETIVOS

**Definição:** oportunidades reais do período — todos os leads gerados menos as perdas
de leads que nunca chegaram a ser trabalhados.

```
leads_efetivos = leads_total − leads_descartados

leads_descartados = perdas (SDR + Closer) cujo `[SDR] Motivo de perda`
                    está em MOTIVOS_NAO_EFETIVOS
```

**`MOTIVOS_NAO_EFETIVOS`** (em `extract.py`, exportado para `data.js`) — 4 motivos desde 2026-09-01:
`Card Duplicado` · `Testes` · `Dados incorretos/ Impossível contato` · `Sem Contato / Nunca respondeu!`

> 📌 **Histórico da regra.** Em 2026-08-03 o usuário mandou **retirar** `Sem Contato / Sem Resposta`
> (o lead é real, apenas não respondeu). Em 2026-09-01 decidiu **reincluir** esse mesmo motivo,
> que nesse meio-tempo o Bitrix renomeou para `Sem Contato / Nunca respondeu!`. O rename foi
> **retroativo** — a grafia antiga não existe mais em nenhum registro da base, então não há
> duas grafias convivendo.

> ⚠️ **Não confundir** `Sem Contato / Nunca respondeu!` (descartado — nunca houve contato) com
> `Sem contato/ Cliente não retorna mais` (**não** descartado — houve contato e depois o cliente
> sumiu). São motivos distintos e o segundo é oportunidade real.

> ⚠️ Grafia revalidada contra as bases em 2026-09-01. Se um motivo for renomeado no Bitrix,
> ele deixa de ser descontado **silenciosamente** — o número de efetivos apenas sobe, sem erro.
> Revalidar junto com `FASES_PERDIDO_SDR` a cada update.

### Por que não é uma soma de parcelas
A formulação original era *"Em Andamento SDR + Leads em Closer + Perdidos em Closer ou SDR
(exceto os motivos)"*. Somar assim conta os perdidos do Closer **duas vezes**, porque
`leads_closer` já inclui ganhos, perdidos e em aberto daquele pipeline (em Jul/26 isso daria
136 em vez de 125). Por isso a implementação é `total − descartados`, que é a mesma
intenção sem dupla contagem e trata SDR e Closer simetricamente.

### Onde aparece
Aba 5 (`Tab4_AnaliseSdr.jsx`) — 2º card da linha de KPIs, mais a nota explicativa logo abaixo.
A nota lê `MOTIVOS_NAO_EFETIVOS` de `data.js`, então **o texto se atualiza sozinho** quando a
lista muda no `extract.py`. Nunca duplicar essa lista no front.

**Referência Ago/26** (com os 4 motivos): 236 gerados − 81 descartados = **155 efetivos (65,7%)**
(descartados no SDR: Sem Contato / Nunca respondeu! 38 + Card Duplicado 31 + Dados incorretos 7
+ Testes 5; nenhum no Closer)

> A inclusão do 4º motivo derrubou a taxa de efetividade de ~85% para ~47-66%, porque
> `Sem Contato / Nunca respondeu!` é o motivo de perda mais volumoso da base (1.152 no SDR).

---

## 15. INTEGRAÇÃO BITRIX24 (WEBHOOK REST) — substitui as 4 planilhas do CRM

> **Status (2026-09-30): EM PRODUÇÃO.** `scripts/bitrix_source.py` + `extract.py` (fonte padrão
> `bitrix`) + `scripts/auto_update.py` agendado às 06:00. Planilhas exportadas = backup.

### 15.1 Credencial
- Inbound Webhook do Bitrix24, portal `tljmkt.bitrix24.com.br`, usuário **36649 (Gustavo Wandeur, ADMIN)**.
- URL em `.env.local` → `BITRIX_WEBHOOK_URL=...` (gitignored). **Nunca** commitar, logar ou colar em
  arquivo versionado — o repo é público e a URL dá acesso **total de administrador ao CRM**
  (ler, alterar e apagar negócios, contatos, empresas). É mais sensível que o Deploy Hook.
- Se `.env.local` não existir na sessão: pedir a URL ao usuário.
- Escopo atual: só `crm`. `user.get` retorna `insufficient_scope` (ver §15.4).
- **Regra do código:** o extrator só pode chamar métodos de leitura (`*.list`, `*.get`, `*.fields`).
  Nunca `*.add`, `*.update`, `*.delete`.
- Chamada: `POST {BITRIX_WEBHOOK_URL}{metodo}.json` com corpo JSON. Paginação de 50 em 50 —
  usar `order: {ID: ASC}`, `filter: {'>ID': ultimo}`, `start: -1` (rápido, sem contagem).
  Carga completa das 4 bases + empresas ≈ 100 s.

### 15.2 Pipelines (crm.category.list, entityTypeId=2)
| Planilha atual | CATEGORY_ID | Nome no Bitrix | Filtro que reproduz a planilha |
|---|---|---|---|
| BASE SDR | `0` | SDR | `>=DATE_MODIFY 2025-01-01` (**"MODIFICADO"** no nome do arquivo = modificado desde 2025) |
| BASE CLOSER | `107` | Closer Comercial | nenhum (pipeline inteiro) |
| BASE RENTABILIZAÇÃO | `103` | Rentabilização | nenhum |
| BASE LICENÇAS | `129` | Licenças | nenhum |

Existem outros pipelines **fora** do dashboard hoje: `113` Rentabilização Inner - WhatsApp,
`133` Outbound - Visita PAP, `137` Vendas Low-Ticket, `119` CS Grupo, etc. Não incluir sem decisão do usuário.

Nomes de fase: `crm.status.list` com `ENTITY_ID = DEAL_STAGE` (cat 0) ou `DEAL_STAGE_{cat}`.
O campo `EXTRA.SEMANTICS` (`success`/`failure`/`apology`/`process`) é estável mesmo quando o
Bitrix renomeia a fase — útil para detectar renames (ex: `C103:WON` = `8 - Venda Paga`).

### 15.3 Mapeamento coluna da planilha → campo da API (validado registro a registro)
| Coluna (Excel) | Campo API | Conversão |
|---|---|---|
| `ID` | `ID` | int |
| `Nome do negócio` | `TITLE` | colapsar espaços duplos (a exportação Excel faz isso) |
| `Fase` | `STAGE_ID` | → nome via `crm.status.list` |
| `Criado` | `DATE_CREATE` | datetime: converter de UTC+3 (servidor) para `America/Sao_Paulo` |
| `Data da mudança de etapa` | `MOVED_TIME` | idem `Criado` |
| `Data de fechamento` | `CLOSEDATE` | ⚠️ **só data**: usar os 10 primeiros caracteres; converter fuso desloca 1 dia |
| `[LC] Data de vencimento` | `UF_CRM_43_1709127323` | ⚠️ só data, idem |
| `Renda` | `OPPORTUNITY` | float |
| `Fonte` | `SOURCE_ID` | → nome via `crm.status.list ENTITY_ID=SOURCE`; se não mapear, manter o código cru (é o que o Excel mostra); vazio → nulo |
| `Responsável` | `ASSIGNED_BY_ID` | → nome (ver §15.4) |
| `#TLJ# SDR` | `UF_CRM_1731100890` | → nome (ver §15.4) |
| `Empresa` | `COMPANY_ID` | → `TITLE` via `crm.company.list` (lotes de 50 IDs); strip |
| `[SDR] Motivo de perda` | `UF_CRM_63DAB89F51656` | enum → texto via `crm.deal.fields` `items` |
| `É renovação?` | `UF_CRM_1736878725444` | enum (`Sim`/`Não`) |
| `[LC] Motivo de perda` | `UF_CRM_66E3304029CF4` | enum |
| `[LC] Cliente está usando Bitrix?` | `UF_CRM_1777929842107` | enum **múltiplo** (lista) |

⚠️ Não confundir com `UF_CRM_66D9B6C480F87` ("Motivo de perda errado não preencher") nem
`UF_CRM_658C2C2CB2A06` ("Motivo de perda DELETAR") — campos antigos.

### 15.4 Nomes de pessoas
O webhook não tem escopo `user`, então a API devolve só o ID (ex: `67065`). Os 43 IDs em uso
foram mapeados 1:1 para nomes a partir das planilhas de 30.09 → `scripts/bitrix_users.json`
(versionado; os nomes já são públicos no data.js). O arquivo tem **prioridade** — mantém a
grafia que o dashboard sempre usou.
- ID sem nome no arquivo → `bitrix_source.resolve_users` tenta `user.get`; se o webhook tiver o
  escopo **`user_brief`**, grava o nome no arquivo sozinho (o auto_update commita junto).
- Sem o escopo → a pessoa aparece como `Usuário 12345` e o log registra AVISO. Correção:
  acrescentar `"12345": "Nome Sobrenome"` no JSON, ou pedir ao desenvolvedor o escopo
  `user_brief` (Bitrix → Aplicativos → Webhooks → editar → Permissões).

### 15.5 Prova de equivalência (2026-09-30)
Rodando o `extract.py` atual com os dados da API no lugar das planilhas de 30.09:
- Contagem de registros idêntica (SDR 5.502 · Closer 1.290 · Rent 748+1 novo · LC 275)
- **Todos os KPIs de Jan/25 a Jul/26 idênticos** (leads, vendas, receita, incrementos, ROI, PP)
- Ago–Set/26: diferenças só de negócios movidos pelo time **depois** da exportação (API é ao vivo)
- Após os ajustes abaixo: **Jan/25–Jul/26 idênticos campo a campo** (inclusive por fonte e
  listas de detalhe) entre `--source bitrix` e `--source excel`.
- Ajustes que tornaram a saída determinística (valem para as duas fontes):
  - `_top()`: top-n de motivos/fontes com desempate por nome (antes dependia da ordem das linhas)
  - `_vlookup_fonte`: empresa com várias vendas de fontes diferentes → vale a **mais recente**
    (maior ID) — era o que a ordem da planilha (ID decrescente) fazia implicitamente
  - Bitrix devolvido em ID decrescente, como a exportação

### 15.6 Decisões do usuário (2026-09-30)
1. **Pipelines extras** (Inner WhatsApp 113, Outbound PAP 133, Low-Ticket 137): **fora**, até segunda ordem.
2. **Frequência:** automática, **todo dia às 06:00**, rodando **neste PC** (não na nuvem — o
   link do Bitrix não sai do computador e a planilha de investimentos fica em `Reports/`).
3. **Investimentos:** continuam em `Reports/INVESTIMENTOS.xlsx`, mesmo formato.
4. **Planilhas exportadas:** mantidas só como backup (`--source excel`).
5. **Mês em andamento:** o dashboard abre no **último mês fechado**; o mês corrente aparece
   como "(parcial)"; sem investimento lançado → "Aguardando investimento" (§15.7).
6. Pendente com o desenvolvedor (opcional): escopo `user_brief` e webhook de usuário só-leitura.

### 15.7 Mês em andamento e investimento pendente
`extract.py` marca cada mês de `DATA`/`DATA_TERMINO` com:
- `parcial: true` → mês corrente (fuso São Paulo). `ALL_MONTHS` vai de Jan/25 até o mês
  corrente **automaticamente** — não há mais lista de meses para editar.
- `inv_pendente: true` → mês sem coluna (ou com 0) em INVESTIMENTOS.xlsx.

Front (`src/utils/months.js`):
- `App.jsx` abre em `LAST_CLOSED` (6 meses até ele no filtro "Criado em").
- Séries fixas de 6 meses (`LAST6_RAW`, Tabela de Investimentos) usam só meses fechados.
- `CURR.inv_pendente` = algum mês do período sem investimento → Tab6 mostra "—" /
  "Aguardando investimento" em Total Investido, ROI, Lucro Bruto, CAC, CPL e Leads/R$1k;
  `alertEngine` não dispara alertas de ROI/CPL; gráficos recebem `null` (pulam o ponto).
- PeriodSelector: rótulo "Out/26 (parcial)", atalhos "Mês em andamento" e "Último mês fechado".
- Rodapé: "Dados atualizados em dd/mm/aaaa às hh:mm" (`ATUALIZADO_EM` do data.js).

### 15.8 Automação diária (`scripts/auto_update.py`)
- Tarefa do Windows **`TLJ Dashboard - Atualizacao diaria`**, 06:00, criada por
  `scripts/registrar_agendamento.ps1` (rodar de novo recria/atualiza). Usa `pythonw` (sem janela),
  acorda o PC se estiver dormindo, roda ao ligar se o PC estava desligado, só com o usuário
  logado (usa as credenciais do Git do Windows para o push).
- Passos: espera internet (até 10 min) → `git fetch`/`pull --rebase` → `extract.main('bitrix')`
  → travas → se os dados não mudaram, para → `npm run build` → `git commit -- src/data/data.js
  [scripts/bitrix_users.json]` → push → Deploy Hook.
- **Travas (se qualquer uma falhar, NÃO publica)**:
  1. `check_bitrix_schema` (extract.py): usa a SEMÂNTICA das fases (success/failure/apology),
     que o Bitrix mantém quando alguém renomeia uma etapa. Fase de perda do SDR fora de
     `FASES_PERDIDO_SDR`, ganho do Closer ≠ `Venda - Ganho`, ganho da Rentabilização fora de
     `FASES_GANHO_RENT`, fases de Licenças fora dos sets, ou motivo de `MOTIVOS_NAO_EFETIVOS`
     inexistente → `SchemaError`. Campo personalizado sumido → `BitrixError`.
  2. Coerência §8/§12 em todos os meses (totais, reuniões, efetivos, somas por fonte).
  3. Queda >10% no nº de registros de qualquer base vs última execução boa (`logs/estado.json`),
     ou >10% no total de leads / receita dos meses fechados antigos vs o data.js publicado.
- Falha → `data.js` restaurado, erro em `logs/auto_update.log`, notificação do Windows
  ("Dashboard TLJ: atualização falhou"). O site segue com a última atualização boa.
  Push falhou depois do commit → a próxima execução reenvia.
- Commits automáticos: `data: atualização automática dd/mm/aaaa hh:mm (Bitrix24)` — só data.js.
- Testar sem publicar: `python scripts/auto_update.py --dry-run`.
- Ver a tarefa: `Get-ScheduledTask -TaskName 'TLJ Dashboard - Atualizacao diaria' | Get-ScheduledTaskInfo`.

---

*Última atualização: Set/2026 | v5.0 — Atualização automática diária via Bitrix24 (§5, §15)*

*Anterior: v4.8 — Rentabilização: fase de ganho renomeada para `8 - Venda Paga` (§3.3)*
