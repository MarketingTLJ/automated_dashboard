import { fmtCents } from '../../utils/formatters.js';

// Faixa informativa de evento (CLAUDE.md §16) — Resumo Executivo e Investimentos.
export function EventoNote({ notes }) {
  if (!notes?.length) return null;
  return (
    <div className="space-y-2 mb-5">
      {notes.map(n => {
        const share = n.sharePct !== null ? ` (${n.sharePct}%)` : '';
        return (
          <div key={`${n.ym}-${n.nome}`}
               className="flex items-start gap-3 p-4 rounded-xl border bg-brand-blue/5 border-brand-blue/20 text-xs leading-relaxed text-gray-700">
            <span className="text-base flex-shrink-0 mt-0.5">📌</span>
            <p>
              <strong className="text-brand-blue">{n.label} · Investimento em evento — {n.nome}.</strong>{' '}
              {n.invPendente
                ? 'O investimento deste mês ainda não foi lançado na planilha.'
                : <>
                    <strong>{fmtCents(n.valor)}</strong> dos {fmtCents(n.invTotal)} investidos no mês{share}{' '}
                    foram destinados ao evento (linha “{n.canal_investimento}” da planilha de investimentos).
                  </>}{' '}
              O evento gerou <strong>{n.leads} leads</strong> (fonte {n.fonte}
              {n.leads > 0 && ` — ${n.ativo} em andamento, ${n.perdido} perdido${n.perdido === 1 ? '' : 's'}`}
              {n.reuniao > 0 && `, ${n.reuniao} com reunião realizada`}),
              {' '}trabalhados no pipeline SDR e contabilizados nos Leads Totais do mês do evento como leads pagos.
            </p>
          </div>
        );
      })}
    </div>
  );
}
