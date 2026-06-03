import { useState, useEffect, useRef } from 'react';
import { DATA } from '../../data/data.js';

const ALL_YMS    = DATA.map(d => d.ym);
const ALL_LABELS = DATA.map(d => d.label);

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const DAY_HEADERS = ['D','S','T','Q','Q','S','S'];

function getCalendarDays(year, month) {
  const firstDow  = new Date(year, month, 1).getDay();
  const daysCount = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < firstDow; i++) days.push(null);
  for (let d = 1; d <= daysCount; d++) days.push(d);
  return days;
}

function toYm(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function fromYm(ym) {
  return { year: parseInt(ym.slice(0, 4)), month: parseInt(ym.slice(5, 7)) - 1 };
}

function fmtLabel(ym) {
  const i = ALL_YMS.indexOf(ym);
  return i >= 0 ? ALL_LABELS[i] : ym;
}

function getPresets() {
  const last = ALL_YMS.at(-1);
  const get  = (n) => ALL_YMS.at(-n) ?? ALL_YMS[0];
  const y25  = ALL_YMS.filter(ym => ym.startsWith('2025'));
  const y26  = ALL_YMS.filter(ym => ym.startsWith('2026'));
  return [
    { label: 'Este mês',            start: last,                  end: last },
    { label: 'Mês passado',         start: get(2),                end: get(2) },
    { label: 'Últimos 3 meses',     start: get(3),                end: last },
    { label: 'Últimos 6 meses',     start: get(6),                end: last },
    { label: 'Último trimestre',    start: get(4),                end: last },
    { label: 'Últimos 12 meses',    start: get(12),               end: last },
    { label: 'Ano atual (2026)',     start: y26[0] ?? last,        end: last },
    { label: 'Ano anterior (2025)', start: y25[0] ?? ALL_YMS[0],  end: y25.at(-1) ?? last },
    { label: 'Tudo',                start: ALL_YMS[0],            end: last },
  ];
}

function CalPanel({ header, calYear, calMonth, onNav, pendingStart, pendingEnd, onDayClick }) {
  const ym          = toYm(calYear, calMonth);
  const days        = getCalendarDays(calYear, calMonth);
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const isAvail     = ALL_YMS.includes(ym);

  const inRange = ym >= pendingStart && ym <= pendingEnd;
  const isStart = ym === pendingStart;
  const isEnd   = ym === pendingEnd;

  return (
    <div className="flex-1 min-w-[200px] px-4 py-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center mb-3">
        {header}
      </p>

      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => onNav(-1)}
          className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-gray-800">
          {MONTH_NAMES[calMonth].slice(0, 3)}. de {calYear}
        </span>
        <button
          onClick={() => onNav(1)}
          className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map((d, i) => (
          <div key={i} className="text-center text-xs text-gray-400 font-medium py-0.5">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day, i) => {
          if (day === null) return <div key={i} />;

          const isFirstDay = day === 1;
          const isLastDay  = day === daysInMonth;
          const endpoint   = (isStart && isFirstDay) || (isEnd && isLastDay);
          const highlight  = inRange && isAvail;

          return (
            <button
              key={i}
              onClick={() => isAvail && onDayClick(ym)}
              disabled={!isAvail}
              className={`
                text-xs py-1.5 text-center transition-all leading-none
                ${!isAvail ? 'text-gray-300 cursor-default' : 'cursor-pointer'}
                ${highlight && !endpoint ? 'bg-brand-blue/10 text-brand-blue' : ''}
                ${endpoint ? 'bg-brand-blue text-white font-bold rounded-full' : ''}
                ${isAvail && !highlight ? 'hover:bg-gray-100 text-gray-700 rounded' : ''}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PeriodSelector({ mode = 'criado', start, end, onStartChange, onEndChange }) {
  const [open,     setOpen]     = useState(false);
  const [pending,  setPending]  = useState({ start, end });
  const [picking,  setPicking]  = useState(true);
  const [leftCal,  setLeftCal]  = useState(fromYm(start));
  const [rightCal, setRightCal] = useState(fromYm(end));
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const openPicker = () => {
    setPending({ start, end });
    setPicking(true);
    setLeftCal(fromYm(start));
    setRightCal(fromYm(end));
    setOpen(true);
  };

  const handleDayClick = (ym) => {
    if (!ALL_YMS.includes(ym)) return;
    if (picking) {
      const d = fromYm(ym);
      setPending({ start: ym, end: ym });
      setLeftCal(d);
      setRightCal(d);
      setPicking(false);
    } else {
      if (ym >= pending.start) {
        setPending(p => ({ ...p, end: ym }));
        setRightCal(fromYm(ym));
      } else {
        setPending({ start: ym, end: pending.start });
        setLeftCal(fromYm(ym));
      }
      setPicking(true);
    }
  };

  const navCal = (side, delta) => {
    const setter = side === 'left' ? setLeftCal : setRightCal;
    setter(c => {
      let m = c.month + delta;
      let y = c.year;
      if (m < 0)  { m = 11; y--; }
      if (m > 11) { m = 0;  y++; }
      return { year: y, month: m };
    });
  };

  const apply = () => {
    onStartChange(pending.start);
    onEndChange(pending.end);
    setOpen(false);
  };

  // Preset click: update calendars and pending WITHOUT closing — user confirms with "Aplicar"
  const applyPreset = (p) => {
    setPending({ start: p.start, end: p.end });
    setLeftCal(fromYm(p.start));
    setRightCal(fromYm(p.end));
    setPicking(true);
  };

  const presets   = getPresets();
  const isCriado  = mode !== 'termino';
  const modeLabel = isCriado ? 'Criado em' : 'Data de Término';
  const badgeCls  = isCriado
    ? 'bg-brand-blue/10 text-brand-blue'
    : 'bg-red-50 text-brand-red';
  const borderCls = isCriado
    ? 'border-brand-blue/20 hover:border-brand-blue/40'
    : 'border-red-200 hover:border-red-300';
  const activeCls = isCriado ? 'bg-brand-blue/10 text-brand-blue font-semibold' : 'bg-red-50 text-brand-red font-semibold';
  const btnApply  = isCriado ? 'bg-brand-blue hover:bg-brand-blue-mid' : 'bg-brand-red hover:opacity-90';

  const rangeLabel = start === end
    ? fmtLabel(start)
    : `${fmtLabel(start)} → ${fmtLabel(end)}`;

  // A preset is "pending-active" if its range matches what's currently pending in the open picker
  const isPendingActive = (p) => p.start === pending.start && p.end === pending.end;
  // A preset is "applied-active" if it matches the committed state
  const isAppliedActive = (p) => p.start === start && p.end === end;

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={openPicker}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border bg-white shadow-sm hover:shadow-md transition-all text-sm font-medium text-gray-700 ${borderCls}`}
      >
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>{rangeLabel}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded-md font-semibold ${badgeCls}`}>
          {modeLabel}
        </span>
        <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Popup — fully opaque white */}
      {open && (
        <div
          className="absolute top-full mt-2 z-[200] rounded-2xl overflow-hidden"
          style={{
            width: 720,
            maxWidth: 'calc(100vw - 2rem)',
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.10)',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
          }}
        >
          {/* Mode label */}
          <div style={{ background: '#ffffff' }} className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-gray-100">
            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${badgeCls}`}>
              {modeLabel}
            </span>
            <span className="text-xs text-gray-500">
              {picking ? 'Selecione a data de início' : 'Selecione a data de término'}
            </span>
          </div>

          <div className="flex" style={{ background: '#ffffff' }}>
            {/* Left calendar */}
            <div className="border-r border-gray-100" style={{ background: '#ffffff' }}>
              <CalPanel
                header="Data de início"
                calYear={leftCal.year}
                calMonth={leftCal.month}
                onNav={(d) => navCal('left', d)}
                pendingStart={pending.start}
                pendingEnd={pending.end}
                onDayClick={handleDayClick}
              />
            </div>

            {/* Right calendar */}
            <div className="border-r border-gray-100" style={{ background: '#ffffff' }}>
              <CalPanel
                header="Data de término"
                calYear={rightCal.year}
                calMonth={rightCal.month}
                onNav={(d) => navCal('right', d)}
                pendingStart={pending.start}
                pendingEnd={pending.end}
                onDayClick={handleDayClick}
              />
            </div>

            {/* Presets */}
            <div className="w-44 py-3 flex flex-col gap-0.5 flex-shrink-0" style={{ background: '#ffffff' }}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1">Atalhos</p>
              {presets.map(p => {
                const pendingActive = isPendingActive(p);
                const appliedActive = isAppliedActive(p);
                return (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p)}
                    className={`text-left px-3 py-1.5 text-xs transition-all rounded-md mx-1 ${
                      pendingActive
                        ? activeCls
                        : appliedActive
                          ? 'text-gray-500 bg-gray-50'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    {p.label}
                    {appliedActive && !pendingActive && (
                      <span className="ml-1 text-gray-400">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer — fully opaque */}
          <div style={{ background: '#f9fafb', borderTop: '1px solid #f3f4f6' }}
               className="flex items-center justify-between px-4 py-3">
            <p className="text-xs text-gray-500 font-medium">
              {fmtLabel(pending.start)}
              {pending.start !== pending.end && (
                <span className="text-gray-400"> → {fmtLabel(pending.end)}</span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={apply}
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-lg transition-all shadow-sm ${btnApply}`}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
