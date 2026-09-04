import { useState, Fragment } from 'react';
import { fmt, pct, sclCls } from '../../utils/formatters.js';

const BITRIX_DEAL_URL = id => `https://tljmkt.bitrix24.com.br/crm/deal/details/${id}/`;

export function InvestmentTable({ last6 }) {
  const [selMonth, setSelMonth] = useState(null);

  // Mais recente primeiro (last6 vem em ordem cronológica ascendente)
  const rows = [...last6].reverse();

  return (
    <div className="glass-card rounded-2xl overflow-auto">
      <div className="p-5 border-b border-gray-200">
        <p className="text-gray-900 font-semibold text-sm">Tabela de Investimentos</p>
        <p className="text-gray-600 text-xs mt-0.5">👆 Clique no mês para ver as vendas detalhadas</p>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 text-gray-600 uppercase tracking-wider">
            <th className="p-4 text-left">Mês</th>
            <th className="p-4 text-right">Investimento</th>
            <th className="p-4 text-right">Leads</th>
            <th className="p-4 text-right">Leads Efetivos</th>
            <th className="p-4 text-right">Nº Reuniões</th>
            <th className="p-4 text-right">Taxa Conv. Reunião</th>
            <th className="p-4 text-right">CPL (Leads Efetivos)</th>
            <th className="p-4 text-right">Nº Vendas</th>
            <th className="p-4 text-right">Valor em Vendas</th>
            <th className="p-4 text-right">Taxa Conv. (Vendas)</th>
            <th className="p-4 text-right">ROI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d, i) => {
            const isCurrent = i === 0;
            const isSel = selMonth === d.ym;
            const cplEfetivos = d.leads_efetivos > 0 ? d.inv / d.leads_efetivos : 0;
            const vendas = d.vendas_detalhe || [];
            return (
              <Fragment key={d.ym}>
                <tr
                  onClick={() => setSelMonth(isSel ? null : d.ym)}
                  className={`border-b border-gray-100 cursor-pointer transition-all ${
                    isSel ? 'bg-cyan-500/10' : isCurrent ? 'bg-brand-blue/10' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className={`p-4 font-bold ${isCurrent ? 'text-brand-blue-light' : 'text-gray-600'}`}>
                    {d.label}{isCurrent ? ' ★' : ''} {isSel ? '▲' : '▼'}
                  </td>
                  <td className="p-4 text-right text-brand-blue-light font-mono">{fmt(d.inv)}</td>
                  <td className="p-4 text-right text-gray-600">{d.leads_total}</td>
                  <td className="p-4 text-right text-gray-600">{d.leads_efetivos}</td>
                  <td className="p-4 text-right text-gray-600">{d.reunioes}</td>
                  <td className="p-4 text-right text-gray-600">{pct(d.reunioes, d.leads_efetivos)}</td>
                  <td className="p-4 text-right text-cyan-400 font-mono">{fmt(cplEfetivos)}</td>
                  <td className="p-4 text-right text-gray-600">{d.qtd_v}</td>
                  <td className="p-4 text-right text-green-400 font-mono">{fmt(d.rec_v)}</td>
                  <td className="p-4 text-right text-gray-600">{pct(d.qtd_v, d.leads_efetivos)}</td>
                  <td className="p-4 text-right">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${sclCls(d.roi, [15, 10])}`}>
                      {d.roi}x
                    </span>
                  </td>
                </tr>
                {isSel && (
                  <tr key={`vd-${d.ym}`} className="bg-cyan-500/5 border-b border-cyan-500/20">
                    <td colSpan={11} className="p-0">
                      <div className="px-5 pb-4 pt-2">
                        <p className="text-cyan-600 text-xs font-semibold uppercase tracking-wider mb-2">
                          Vendas — {d.label} ({vendas.length})
                        </p>
                        {vendas.length > 0 ? (
                          <div className="overflow-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500 uppercase tracking-wider">
                                  <th className="py-2 pr-4 text-left">ID</th>
                                  <th className="py-2 pr-4 text-left">Nome do Negócio</th>
                                  <th className="py-2 pr-4 text-left">Fonte</th>
                                  <th className="py-2 pr-4 text-left">Responsável</th>
                                  <th className="py-2 pr-4 text-right">Valor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {[...vendas].sort((a, b) => b.valor - a.valor).map(v => (
                                  <tr key={v.id} className="border-t border-gray-100">
                                    <td className="py-2 pr-4 text-gray-500">{v.id}</td>
                                    <td className="py-2 pr-4 max-w-xs truncate">
                                      <a
                                        href={BITRIX_DEAL_URL(v.id)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={v.nome}
                                        className="text-gray-800 hover:text-cyan-600 hover:underline"
                                      >
                                        {v.nome}
                                      </a>
                                    </td>
                                    <td className="py-2 pr-4 text-gray-600">{v.fonte}</td>
                                    <td className="py-2 pr-4 text-gray-600">{v.responsavel}</td>
                                    <td className="py-2 pr-4 text-right text-green-400 font-mono">{fmt(v.valor)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-gray-500 text-xs py-2">Nenhuma venda neste mês.</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
