import { useState } from 'react';
import { fmt } from '../../utils/formatters.js';
import { COLORS, BITRIX_DEAL_URL } from '../../constants/index.js';

const n = v => (v ?? 0).toLocaleString('pt-BR');

function FasePill({ fase }) {
  const cor = fase === 'Venda - Ganho' ? COLORS.ganho : fase === 'Perdido' ? COLORS.perdido : COLORS.aberto;
  const txt = fase === 'Venda - Ganho' ? 'Ganho' : fase === 'Perdido' ? 'Perdido' : `Em aberto · ${fase}`;
  return (
    <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap"
      style={{ color: cor, background: `${cor}1a` }}>{txt}</span>
  );
}

/**
 * Explica por que o Funil Comercial e o Funil SDR têm números diferentes: os negócios
 * criados direto no Closer (sem SDR) só entram no Comercial.
 *  variant="comercial" → texto + lista dos negócios do período (abre/fecha)
 *  variant="sdr"       → texto curto apontando para a lista na aba Funil Comercial
 * periodo/seis = diretosCloser() de utils/funil.js · lista = CURR.closer_diretos
 */
export function CloserDiretosNote({ variant, periodo, seis, labelPeriodo, lista }) {
  const [aberta, setAberta] = useState(false);
  if (!periodo || !seis) return null;

  const resumo = (r, label) => (
    <>
      {label}: <strong className="text-gray-700">{n(r.total)}</strong> negócio(s) criados direto no Closer
      {' → '}<strong style={{ color: COLORS.ganho }}>{n(r.vendas)}</strong> venda(s)
      {r.aberto > 0 && <> (+{n(r.aberto)} em negociação)</>}
    </>
  );

  return (
    <div className="mt-5 rounded-xl p-4 border-l-4 bg-gray-50" style={{ borderLeftColor: COLORS.oportunidades }}>
      {variant === 'comercial' ? (
        <>
          <p className="text-gray-900 text-xs font-semibold mb-1.5">
            ℹ️ Por que este funil tem números maiores que o Funil SDR (aba Análise SDR)?
          </p>
          <p className="text-gray-600 text-xs leading-relaxed">
            O <strong>Funil Comercial</strong> conta <strong>todos</strong> os leads da empresa. Além dos que passaram
            pelo SDR, ele inclui os negócios criados <strong>direto no Closer</strong>, sem passar pelo SDR — por exemplo
            indicações e clientes da carteira. Esses negócios entram em todas as etapas daqui (leads, efetivos, reuniões,
            oportunidades e vendas). O <strong>Funil SDR</strong> conta só os leads trabalhados pelo time de SDR.
          </p>
        </>
      ) : (
        <>
          <p className="text-gray-900 text-xs font-semibold mb-1.5">
            ℹ️ Por que este funil tem números menores que o Funil Comercial?
          </p>
          <p className="text-gray-600 text-xs leading-relaxed">
            Este funil conta <strong>só os leads que passaram pelo SDR</strong>. Os negócios criados
            <strong> direto no Closer</strong> (sem SDR — por exemplo indicações e clientes da carteira) ficam de fora
            daqui e aparecem no Funil Comercial. A lista desses negócios está na aba <strong>Funil Comercial</strong>,
            no fim da página.
          </p>
        </>
      )}

      <ul className="text-gray-500 text-xs mt-2 space-y-0.5">
        <li>• {resumo(periodo, `No período (${labelPeriodo})`)}</li>
        <li>• {resumo(seis, 'Nos últimos 6 meses fechados')}</li>
      </ul>

      {variant === 'comercial' && lista && lista.length > 0 && (
        <>
          <button
            onClick={() => setAberta(a => !a)}
            className="mt-3 text-xs font-semibold text-brand-blue hover:bg-brand-blue/5 px-3 py-1.5 rounded-lg transition-all"
          >
            {aberta ? '▲ Ocultar a lista' : `▼ Ver os ${n(lista.length)} negócios criados direto no Closer`}
          </button>
          {aberta && (
            <div className="mt-2 max-h-96 overflow-auto rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <th className="py-2 px-3 text-left">Criado</th>
                    <th className="py-2 px-3 text-left">Negócio</th>
                    <th className="py-2 px-3 text-left">Fonte</th>
                    <th className="py-2 px-3 text-left">Responsável</th>
                    <th className="py-2 px-3 text-left">Situação</th>
                    <th className="py-2 px-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(d => (
                    <tr key={d.id} className="border-t border-gray-100">
                      <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{d.criado}</td>
                      <td className="py-2 px-3 max-w-xs truncate">
                        <a href={BITRIX_DEAL_URL(d.id)} target="_blank" rel="noopener noreferrer" title={d.nome}
                          className="text-gray-800 hover:text-cyan-600 hover:underline">{d.nome || `#${d.id}`}</a>
                      </td>
                      <td className="py-2 px-3 text-gray-600">{d.fonte}</td>
                      <td className="py-2 px-3 text-gray-600">{d.responsavel}</td>
                      <td className="py-2 px-3"><FasePill fase={d.fase} /></td>
                      <td className="py-2 px-3 text-right text-gray-700 font-mono">{d.valor ? fmt(d.valor) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
