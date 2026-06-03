// ── TLJ Brand Colors ──────────────────────────────────────────────────────────
export const COLORS = {
  // Brand
  brandBlue:      '#213761',
  brandBlueMid:   '#2a4a82',
  brandBlueLight: '#3374B5',
  brandRed:       '#E31E24',
  brandRedDark:   '#b81519',

  // Semantic — chart data series
  vendas:      '#3374B5',  // new sales — brand blue light
  incrementos: '#10b981',  // increments — emerald
  renovacoes:  '#0e7490',  // renewals — teal-700 (variation of cpl cyan, darker)
  leads:       '#60a5fa',  // leads — soft blue
  reunioes:    '#2563eb',  // meetings — blue-600 (variation of leads, darker)
  ganho:       '#22c55e',  // won — green
  perdido:     '#E31E24',  // lost — brand red
  aberto:      '#64748b',  // open — slate-500 (neutral, pending state)
  roi:         '#3374B5',  // ROI — brand blue light
  cpl:         '#06b6d4',  // CPL — cyan
  ticket:      '#22c55e',  // ticket — green

  // Licenças CS
  lcRenovado:  '#0d9488',  // teal-600 — licenças renovadas
  lcCancelado: '#e11d48',  // rose-600 — churn / cancelado
  lcAberto:    '#64748b',  // slate-500 — em aberto / pendente

  // UI states
  success: '#22c55e',
  warning: '#f97316',  // orange-500 (replaces amber)
  danger:  '#E31E24',
  info:    '#3374B5',
  muted:   '#6b7280',
};

// ── Semaphore Thresholds [good, warn] (value >= good = green, >= warn = amber, else red) ──
export const THR = {
  taxaFechCloser: [30, 15],  // %
  taxaConvGeral:  [8,  4],   // %
  taxaConvSdr:    [15, 8],   // %
  roi:            [15, 10],  // x
  cpL:            [30, 50],  // R$ (inverted: lower is better)
};

// ── Dashboard Tabs ─────────────────────────────────────────────────────────────
export const TABS = [
  { id: 0, label: 'Resumo Executivo', short: 'Resumo'    },
  { id: 1, label: 'Receita',          short: 'Receita'   },
  { id: 2, label: 'Funil Comercial',  short: 'Funil'     },
  { id: 3, label: 'Closers',          short: 'Closers'   },
  { id: 4, label: 'Análise SDR',      short: 'SDR'       },
  { id: 5, label: 'Prop. Perdidas',   short: 'Perdidas'  },
  { id: 6, label: 'Investimentos',    short: 'Invest.'   },
  { id: 7, label: 'Licenças CS',      short: 'Licenças'  },
];

// ── Fontes consideradas pagas (origem: Reports/FontesPagas.xlsx) ──────────────
// Sincronizar com extract.py ao atualizar FontesPagas.xlsx
export const FONTES_PAGAS = [
  'Agendamento on-line', 'E-mail Marketing', 'Facebook Ads', 'Google Ads',
  'JotForm', 'Linkedin', 'Nutrição', 'Redes sociais', 'Tiktok',
  'Whatsapp API TLJ', 'Whatsapp Massivo API', 'Youtube', 'Youtube Ads',
];

// ── Data source flag (future: 'bitrix24') ──────────────────────────────────────
export const DATA_SOURCE = 'excel';

// ── ROI target (reference line in charts and alerts) ──────────────────────────
export const ROI_TARGET = 15;           // x — meta de ROI para linha de referência

// ── Chart opacity for inactive (past) months vs active (current) ─────────────
export const CHART_OPACITY = { active: 1, past: 0.45 };

// ── SDR loss-rate thresholds (used in Tab4) ───────────────────────────────────
export const THR_PERDA_SDR = { critical: 85, warn: 70 };  // %

// ── Licenças CS renewal-rate thresholds (used in Tab7) ───────────────────────
export const THR_RENOVACAO = { good: 70, warn: 50 };  // % taxa de renovação

// ── Alert thresholds (used by alertEngine) ────────────────────────────────────
export const ALERT_THR = {
  roiCritical:         8,    // ROI < 8x → red alert
  taxaGeralCritical:   3,    // % conversion < 3% → red alert
  cplHigh:             50,   // CPL > R$50 → amber alert
  revenueConcentration:60,   // single closer > 60% revenue → red alert
  meetingsDrop:        20,   // reuniões drop > 20% → amber alert
  meetingsRise:        0,    // reuniões rise > 0% → green alert
  incrementsRise:      30,   // incrementos rise > 30% → green alert
  pipelineAberto:      10,   // closer with > 10 aberto + ≤ 1 ganho → alert
};
