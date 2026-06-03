# DESIGN.md — Design System · Grupo TLJ Dashboard

---

## 1. CORES (Tailwind Tokens)

| Token Tailwind | Hex | Uso |
|----------------|-----|-----|
| `brand-blue` | `#213761` | Header bg, seções de marca |
| `brand-blue-mid` | `#2a4a82` | Hover states no header |
| `brand-blue-light` | `#3374B5` | Botões secundários, links, accent |
| `brand-red` | `#E31E24` | CTAs ativos, alertas críticos, badges de tab ativo |
| `brand-red-dark` | `#b81519` | Hover do brand-red |
| `surface-dark` | `#f4f6f9` | Background da página (tema claro) |
| `surface-card` | `#ffffff` | Background de cards e painéis |
| `surface-hover` | `#eef2f7` | Hover de linhas de tabela |
| `surface-border` | `#dde3ec` | Bordas de cards e divisores |

### Cores semânticas (em `constants/index.js`)
```js
vendas:      '#3374B5'  // novas vendas
incrementos: '#10b981'  // incrementos (emerald)
renovacoes:  '#0e7490'  // renovações (teal-700 — variação escura do cpl cyan)
leads:       '#60a5fa'  // leads totais
reunioes:    '#2563eb'  // reuniões (blue-600 — variação escura de leads)
ganho:       '#22c55e'  // ganhos
perdido:     '#E31E24'  // perdidos (brand-red)
aberto:      '#64748b'  // em aberto (slate-500 — neutro para estado pendente)
roi:         '#3374B5'  // ROI
cpl:         '#06b6d4'  // CPL (cyan)
warning:     '#f97316'  // laranja (substituiu âmbar — usar para estados de alerta)
```

---

## 2. TIPOGRAFIA

**Fonte:** DM Sans (Google Fonts) — pesos 400, 500, 600, 700, 800

| Nível | Tamanho | Peso | Uso |
|-------|---------|------|-----|
| Display | 48–56px | 900 (black) | Hero principal |
| H1 | 36px | 800 (extrabold) | Títulos de hero |
| H2 | 24px | 700 (bold) | Títulos de seção |
| Body | 16px | 400 | Texto principal |
| Caption | 12–14px | 500 + uppercase + tracking-widest | Labels de KPI |
| Mono | font-mono | 700 | Valores monetários |

---

## 3. ESPAÇAMENTO

- Cards: `p-5` (20px) padrão
- Seções: `mb-7` (28px) entre KPIs e gráficos
- Border-radius: `rounded-2xl` (16px) para cards, `rounded-xl` (12px) para itens menores
- Alturas de gráfico padrão: `200px`, `220px`, `260px`, `280px`

---

## 4. SISTEMA SEMÁFORO (Thresholds)

| Métrica | Verde (≥) | Âmbar (≥) | Vermelho (<) |
|---------|-----------|-----------|--------------|
| Taxa Fech. Closer | 30% | 15% | 15% |
| Taxa Conv. Geral | 8% | 4% | 4% |
| Taxa Conv. SDR | 15% | 8% | 8% |
| ROI | 15x | 10x | 10x |

---

## 5. ANATOMIA DOS COMPONENTES

### KpiCard
```
┌─────────────────────────────────┐
│  LABEL (xs, uppercase, gray-400) │  [icon 20px, opacity 60%]
│  R$ 00.000 (3xl, black, brand)  │
│  subtexto (xs gray-500)  ▲ 12%  │
└─────────────────────────────────┘
bg: surface-card | border: surface-border | rounded-2xl | p-5
```

### Tabelas interativas
- Fundo de linha expandida: purple (Closers), cyan (SDR), red (PP)
- Ícone ▼/▲ indica estado collapsed/expanded
- Botão "✕ Limpar" para deselect

### Header sticky
- Background: `rgba(33,55,97,0.97)` + `backdrop-filter: blur(12px)`
- Tab ativo: `bg-brand-red text-white font-bold`
- Tab inativo: `text-gray-400 hover:text-white hover:bg-white/10`

---

## 6. GRÁFICOS

### Convenções Recharts
- Mês atual: `opacity={1.0}`
- Meses anteriores: `opacity={0.4}` (barras) ou `0.5` (linhas)
- Grid: `strokeDasharray="3 3" stroke="#1e2a3f"`
- Axes: `fill="#9ca3af" fontSize={10-11}`, `axisLine={false} tickLine={false}`
- Tooltip: componente `ChartTooltip` customizado (sempre usar, nunca default)

### Cores por série (sempre usar os tokens de `COLORS`)
- Novas Vendas: `#3374B5`
- Incrementos: `#10b981`
- Renovações: `#8b5cf6`
- Leads: `#60a5fa`
- Reuniões: `#f59e0b`
- Ganhos: `#22c55e`
- Perdidos: `#E31E24`
- ROI: cor dinâmica via `scl()` (verde ≥15x, âmbar ≥10x, vermelho <10x)

---

## 7. NÃO USAR

- ❌ `#22c55e` como cor primária de marca (era o tema antigo verde genérico)
- ❌ `#8b5cf6` (violeta) — removido; usar `#0e7490` (teal) para renovações
- ❌ `#f59e0b` (âmbar) — removido; usar `#f97316` (orange-500) para avisos, `#64748b` para em aberto, `#2563eb` para reuniões
- ❌ Classes Tailwind `text-amber-*` exceto em contextos herdados do framework
- ❌ Classes Tailwind padrão `blue-*`, `green-*` como cor de marca — usar tokens
- ❌ Cores hardcoded nos componentes — sempre `COLORS.xxx` de `constants/index.js`
- ❌ Outras bibliotecas de gráficos além de Recharts
- ❌ Fontes além de DM Sans

### Legibilidade de texto (tema claro)

| Uso | Classe correta |
|-----|----------------|
| Títulos de seção (uppercase tracking) | `text-gray-700` |
| Labels secundários, notas | `text-gray-600` |
| Valores em tabela (dados não coloridos) | `text-gray-600` |
| Eixos de gráfico | `fill: '#4b5563'` |
| Legendas de gráfico | `color: '#374151'` |
| Texto muito fraco (text-gray-300/400) | ❌ Não usar — mínimo `text-gray-500` |
