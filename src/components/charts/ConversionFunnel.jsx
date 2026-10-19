import { useEffect, useState } from 'react';
import { convPct } from '../../utils/funil.js';
import { DATA, FUNIL_DESDE, FONTE_DADOS } from '../../data/data.js';

// Largura de cada etapa (% do card) — funil em degraus fixos: com conversões de 1-2%
// uma largura proporcional ao volume deixaria as últimas etapas invisíveis.
const LARGURAS = [100, 87, 74, 61, 48];
const LARGURA_BASE = 38; // boca de saída da última etapa

const fmtN   = v => (v ?? 0).toLocaleString('pt-BR');
const fmtPct = v => (v == null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);

// Diferença em pontos percentuais vs os 6 meses (verde = converteu melhor)
function DeltaPP({ v }) {
  if (v == null) return null;
  const neutro = Math.abs(v) < 0.5;
  const cls = neutro ? 'bg-gray-100 text-gray-500'
    : v > 0 ? 'bg-green-500/15 text-green-600' : 'bg-red-500/15 text-red-500';
  return (
    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${cls}`}
      title="Diferença para a conversão dos últimos 6 meses fechados (pontos percentuais)">
      {neutro ? '= 6 meses' : `${v > 0 ? '▲ +' : '▼ '}${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`}
    </span>
  );
}

function Funil({ etapas, compara, meses }) {
  const [pronto, setPronto] = useState(false);
  useEffect(() => { const t = setTimeout(() => setPronto(true), 30); return () => clearTimeout(t); }, []);

  return (
    <div>
      {etapas.map((e, i) => {
        const w     = LARGURAS[i] ?? LARGURAS.at(-1);
        const wNext = LARGURAS[i + 1] ?? LARGURA_BASE;
        const inset = (((w - wNext) / 2) / w) * 100;   // recorte lateral até a próxima etapa
        const prox  = etapas[i + 1];
        const conv  = prox ? convPct(e.value, prox.value) : null;
        const convC = prox && compara ? convPct(compara[i].value, compara[i + 1].value) : null;
        return (
          <div key={e.key}>
            <div
              className="mx-auto h-16 flex flex-col items-center justify-center transition-all duration-700 ease-out hover:brightness-95 cursor-default"
              style={{
                width: pronto ? `${w}%` : '30%',
                opacity: pronto ? 1 : 0,
                clipPath: `polygon(0 0, 100% 0, ${100 - inset}% 100%, ${inset}% 100%)`,
                background: `linear-gradient(180deg, ${e.color}40 0%, ${e.color}1f 100%)`,
                transitionDelay: `${i * 70}ms`,
              }}
              title={e.note}
            >
              <span className="text-2xl font-black leading-none" style={{ color: e.color }}>{fmtN(e.value)}</span>
              <span className="text-gray-700 text-xs font-semibold mt-1">
                {e.label}
                {meses > 1 && <span className="text-gray-500 font-normal"> · ~{fmtN(Math.round(e.value / meses))}/mês</span>}
              </span>
            </div>
            {prox && (
              <div className="flex items-center justify-center gap-2 h-7 text-xs">
                <span className="text-gray-400">↓</span>
                <span className="font-semibold text-gray-700"
                  title={`${e.label} → ${prox.label}`}>{fmtPct(conv)}</span>
                {compara && <DeltaPP v={conv != null && convC != null ? conv - convC : null} />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Dois funis lado a lado: período do filtro "Criado em" × últimos 6 meses fechados.
 * etapasPeriodo/etapasSeis vêm de utils/funil.js (etapasComercial / etapasSdr).
 * children = observações exibidas no rodapé do card.
 */
export function ConversionFunnel({
  titulo, etapasPeriodo, etapasSeis, labelPeriodo, labelSeis, mesesSeis = 6, mesesForaDoFunil = 0, children,
}) {
  const desde = DATA.find(d => d.ym === FUNIL_DESDE)?.label ?? FUNIL_DESDE;
  const motivo = `Até Dez/25 o Bitrix registrava a passagem do SDR para o Closer copiando o card (em vez de movê-lo), `
    + `então o mesmo lead aparecia duas vezes e as etapas não são comparáveis.`;

  if (!etapasPeriodo || !etapasSeis) {
    return (
      <div className="glass-card rounded-2xl p-5 mt-5">
        <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold mb-2">{titulo}</p>
        <p className="text-gray-500 text-xs">
          {FONTE_DADOS === 'excel'
            ? 'Funil disponível apenas com os dados do Bitrix (atualização automática).'
            : <>O funil está disponível para meses a partir de <strong>{desde}</strong>. {motivo}{' '}
                Ajuste o filtro <strong>Criado em</strong> para incluir {desde} ou depois.</>}
        </p>
      </div>
    );
  }

  const topo = arr => arr[0].value;
  const fim  = arr => arr.at(-1);
  const totalP = convPct(topo(etapasPeriodo), fim(etapasPeriodo).value);
  const totalS = convPct(topo(etapasSeis),    fim(etapasSeis).value);
  const abertoP = fim(etapasPeriodo).aberto || 0;
  const abertoS = fim(etapasSeis).aberto || 0;

  const lados = [
    { key: 'p', icon: '📅', nome: 'Período selecionado',        label: labelPeriodo, etapas: etapasPeriodo, compara: etapasSeis, total: totalP, aberto: abertoP, meses: 1 },
    { key: 's', icon: '📊', nome: 'Últimos 6 meses fechados',   label: labelSeis,    etapas: etapasSeis,    compara: null,       total: totalS, aberto: abertoS, meses: mesesSeis },
  ];

  return (
    <div className="glass-card rounded-2xl p-5 mt-5">
      <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold">{titulo}</p>
      <p className="text-gray-500 text-xs mt-1 mb-5">
        Safra por data de criação: cada etapa conta os leads <strong>criados</strong> no período e até onde chegaram.
        As setas mostram a conversão de uma etapa para a seguinte; no período selecionado, comparada com os últimos 6 meses fechados.
      </p>
      {mesesForaDoFunil > 0 && (
        <p className="text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2 -mt-2 mb-5">
          ⚠️ O período selecionado começa antes de {desde}: o funil considera só <strong>{labelPeriodo}</strong>. {motivo}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {lados.map(l => (
          <div key={l.key} className="rounded-xl border border-gray-100 bg-white/60 p-4">
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <p className="text-gray-900 text-sm font-semibold">{l.icon} {l.nome}</p>
              <span className="text-xs font-semibold text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded-md">{l.label}</span>
            </div>

            <Funil etapas={l.etapas} compara={l.compara} meses={l.meses} />

            <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Conversão total (lead → venda)</span>
                <span className="flex items-center gap-2">
                  <span className="font-black text-gray-900">{fmtPct(l.total)}</span>
                  {l.compara && <DeltaPP v={l.total != null && totalS != null ? l.total - totalS : null} />}
                </span>
              </div>
              {l.aberto > 0 && (
                <p className="text-gray-500 text-xs">
                  ⏳ <strong className="text-gray-700">{fmtN(l.aberto)}</strong> negócio(s) desta safra ainda em negociação no Closer — as vendas podem crescer.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Como cada etapa é contada */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {etapasPeriodo.map(e => (
          <div key={e.key} className="flex items-start gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm mt-0.5 flex-shrink-0" style={{ background: e.color }} />
            <span className="text-gray-500"><strong className="text-gray-700">{e.label}:</strong> {e.note}</span>
          </div>
        ))}
      </div>

      {/* Observações da aba (ex.: negócios criados direto no Closer) */}
      {children}
    </div>
  );
}
