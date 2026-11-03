import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { COCKPIT } from '../data/data.js';
import { SectionHeader } from '../components/ui/SectionHeader.jsx';
import { KpiCard } from '../components/ui/KpiCard.jsx';
import { ChartTooltip } from '../components/ui/ChartTooltip.jsx';
import { fmt, fmtCents, fmtNum } from '../utils/formatters.js';
import { COLORS } from '../constants/index.js';
import {
  COCKPIT_OK, COCKPIT_DESDE_LABEL, COR_GRUPO, cockpitPeriodo, agrupar, porDia, porEtapa, eventosCockpit,
} from '../utils/cockpit.js';

// Aba Cockpit AI (CLAUDE.md §20) — 2ª frente do Grupo TLJ: o Cockpit CRM.
// Usa só o filtro "Criado em" (safra de criação). Sem "leads efetivos" (decisão do usuário).

const fmtPct = v => (v == null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
const fmtDataHora = iso => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} às ${iso.slice(11, 16)}` : '—');
const PEND = { value: '—', sub: 'Aguardando investimento', color: COLORS.muted };

const DIMENSOES_UTM = [
  { key: 'camp', label: 'Campanha',          help: 'utm_campaign' },
  { key: 'pub',  label: 'Público / conjunto', help: 'utm_content' },
  { key: 'anun', label: 'Anúncio',           help: 'utm_term' },
  { key: 'plat', label: 'Plataforma',        help: 'utm_source' },
  { key: 'pos',  label: 'Posicionamento',    help: 'utm_medium' },
];

const GRUPO_LABEL = {
  novo: 'Ainda não na planilha', andamento: 'Em andamento', avancado: 'Negociação avançada',
  ganho: 'Fechado', perdido: 'Perdido',
};

function Card({ titulo, sub, children, className = '' }) {
  return (
    <div className={`glass-card rounded-2xl p-5 ${className}`}>
      <p className="text-gray-700 text-xs uppercase tracking-widest font-semibold">{titulo}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** Tabela padrão de desempenho (origem, UTM, responsável) */
function TabelaDesempenho({ linhas, colunaNome, total, mostrarMrr = true }) {
  const max = Math.max(...linhas.map(l => l.total), 1);
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-xs min-w-[640px]">
        <thead>
          <tr className="border-b border-gray-200">
            {[colunaNome, 'Leads', 'Em andamento', 'Negociação avançada', 'Fechados', ...(mostrarMrr ? ['Mensalidades'] : []), 'Perdidos', 'Avanço'].map((h, i) => (
              <th key={h} className={`px-5 py-3 text-gray-600 uppercase tracking-wider text-[11px] ${i === 0 ? 'text-left' : 'text-center'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map(l => (
            <tr key={l.nome} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-5 py-3 text-gray-800 font-semibold max-w-[260px]">
                <div className="truncate" title={l.nome}>{l.nome}</div>
                <div className="w-full bg-gray-100 rounded-full h-1 mt-1.5">
                  <div className="h-1 rounded-full" style={{ width: `${(l.total / max) * 100}%`, background: COLORS.brandBlueLight }} />
                </div>
              </td>
              <td className="px-5 py-3 text-center text-gray-900 font-bold">
                {l.total} <span className="text-gray-500 font-normal">({fmtPct(total > 0 ? (l.total / total) * 100 : null)})</span>
              </td>
              <td className="px-5 py-3 text-center text-gray-600">{l.novo + l.andamento}</td>
              <td className="px-5 py-3 text-center font-semibold" style={{ color: COLORS.ckAvancado }}>{l.avancado || '—'}</td>
              <td className="px-5 py-3 text-center font-bold" style={{ color: COLORS.ckGanho }}>{l.ganho || '—'}</td>
              {mostrarMrr && <td className="px-5 py-3 text-center text-gray-700">{l.mrr > 0 ? fmt(l.mrr) : '—'}</td>}
              <td className="px-5 py-3 text-center" style={{ color: COLORS.ckPerdido }}>{l.perdido || '—'}</td>
              <td className="px-5 py-3 text-center text-gray-700" title="Leads que chegaram a demo/proposta ou fecharam ÷ leads">
                {l.total >= 5 ? fmtPct(l.taxaAvanco) : <span className="text-gray-400">N/A</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlocoLive() {
  const evs = eventosCockpit();
  if (!evs.length) return null;
  return (
    <div className="mt-5">
      {evs.map(n => (
        <Card key={n.ym} titulo={`Antes da conta gratuita · ${n.nome}`}
          sub={`${n.label} · leads trabalhados no pipeline SDR do Bitrix (fonte ${n.fonte}). Bloco separado: não entra nos números acima.`}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { t: 'Investimento', v: n.invPendente ? '—' : fmtCents(n.valor), c: COLORS.brandBlueLight },
              { t: 'Leads', v: n.leads, c: COLORS.leads },
              { t: 'CPL', v: !n.invPendente && n.leads > 0 ? fmtCents(n.valor / n.leads) : '—', c: COLORS.cpl },
              { t: 'Em andamento no SDR', v: n.ativo, c: COLORS.ckAndamento },
              { t: 'Perdidos', v: n.perdido, c: COLORS.ckPerdido },
            ].map(x => (
              <div key={x.t} className="rounded-xl border border-gray-100 bg-white/60 p-3">
                <p className="text-gray-500 text-[11px] uppercase tracking-wider">{x.t}</p>
                <p className="text-xl font-black mt-1" style={{ color: x.c }}>{x.v}</p>
              </div>
            ))}
          </div>
          <p className="text-gray-500 text-xs mt-3">
            {n.reuniao > 0 ? `${n.reuniao} lead(s) chegaram a reunião realizada. ` : 'Nenhum lead da Live chegou a reunião realizada até agora. '}
            A verba e os leads da Live continuam contando nas abas do Grupo em {n.label}. A partir de {COCKPIT_DESDE_LABEL},
            a verba do Cockpit aparece só nesta aba.
          </p>
        </Card>
      ))}
    </div>
  );
}

export function Tab8_CockpitAI({ periodStart, periodEnd }) {
  const [dim, setDim] = useState('camp');

  if (!COCKPIT_OK) {
    return (
      <div>
        <SectionHeader number={8} title="Cockpit AI" subtitle="Cockpit CRM — conta gratuita, funil e vendas" />
        <div className="glass-card rounded-2xl p-8 text-center text-gray-500">
          <p className="text-lg font-semibold mb-2">Dados do Cockpit indisponíveis</p>
          <p className="text-sm">Coloque a exportação do Cockpit (negocios-vendas-AAAA-MM-DD.xlsx) na pasta Reports e rode a atualização.</p>
        </div>
      </div>
    );
  }

  const P = cockpitPeriodo(periodStart, periodEnd);
  const vazio = !P.label;
  const pend = P.invPendente;

  const etapas     = porEtapa(P.leads).filter(e => e.grupo !== 'novo' || e.n > 0);
  const maxEtapa   = Math.max(...etapas.map(e => e.n), 1);
  const diario     = porDia(P.leads);
  const origens    = agrupar(P.leads, l => l.o);
  const contas     = P.leads.filter(l => l.c);
  const utm        = agrupar(contas, l => l.u?.[dim], '(sem UTM)');
  const resp       = agrupar(P.leads, l => l.r, 'Sem responsável');
  const segmentos  = agrupar(contas, l => l.s, 'Não informado').slice(0, 12);
  const maxSeg     = Math.max(...segmentos.map(s => s.total), 1);
  const comUtm     = contas.filter(l => l.u).length;
  const R          = COCKPIT.resumo;
  const dimAtual   = DIMENSOES_UTM.find(d => d.key === dim);

  return (
    <div>
      <SectionHeader number={8} title="Cockpit AI"
        subtitle={`Cockpit CRM — conta gratuita, funil e vendas · ${P.label ?? 'período sem dados'}`} />

      {/* De onde vêm os dados */}
      <div className="flex items-start gap-3 p-4 rounded-xl border bg-brand-blue/5 border-brand-blue/20 text-xs leading-relaxed text-gray-700 mb-5">
        <span className="text-base flex-shrink-0 mt-0.5">📥</span>
        <p>
          <strong className="text-brand-blue">Etapas, responsáveis e valores:</strong> planilha do Cockpit CRM (pipeline Vendas),
          posição de <strong>{fmtDataHora(COCKPIT.posicao_em)}</strong>.{' '}
          <strong className="text-brand-blue">Data do cadastro e UTMs:</strong> Bitrix24 (pipeline Marketing, “Conta gratuita do CRM”),
          atualizado todo dia.
          {R.novos > 0 && <> {R.novos} cadastro(s) feitos depois da exportação aparecem como “Ainda não na planilha”.</>}
          {' '}Esta aba usa só o filtro <strong>Criado em</strong>; os filtros de Fonte e Data de Término não se aplicam.
        </p>
      </div>

      {vazio ? (
        <div className="glass-card rounded-2xl p-8 text-center text-gray-500">
          <p className="text-lg font-semibold mb-2">O Cockpit CRM começou em {COCKPIT_DESDE_LABEL}</p>
          <p className="text-sm">Ajuste o filtro “Criado em” para {COCKPIT_DESDE_LABEL} ou depois. A Live de lançamento (antes da conta gratuita) está no bloco abaixo.</p>
        </div>
      ) : (
        <>
          {/* KPIs — geração de demanda */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <KpiCard title="Leads Cockpit" value={P.total} icon="🧲" color={COLORS.leads}
              sub={`${P.contas} criaram conta gratuita (${fmtPct(P.total ? (P.contas / P.total) * 100 : null)})`} />
            {pend ? <KpiCard title="Investimento Cockpit" {...PEND} icon="📢" /> : (
              <KpiCard title="Investimento Cockpit" value={fmtCents(P.inv)} sub={`Linha “${COCKPIT.canal ?? 'CockpitAI'}” da planilha`}
                color={COLORS.brandBlueLight} icon="📢" />)}
            {pend ? <KpiCard title="CPL" {...PEND} icon="👥" /> : (
              <KpiCard title="CPL" value={P.cpl != null ? fmtCents(P.cpl) : '—'} sub="Investimento ÷ leads" color={COLORS.cpl} icon="👥" />)}
            {pend ? <KpiCard title="Custo por conta gratuita" {...PEND} icon="🆓" /> : (
              <KpiCard title="Custo por conta gratuita" value={P.custoConta != null ? fmtCents(P.custoConta) : '—'}
                sub="Investimento ÷ contas criadas" color={COLORS.ckConta} icon="🆓" />)}
          </div>

          {/* KPIs — resultado */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
            <KpiCard title="Vendas fechadas" value={P.ganho} icon="🏁" color={COLORS.ckGanho}
              sub={`Conversão lead → venda: ${fmtPct(P.taxaVenda)}`} />
            <KpiCard title="Mensalidade conquistada" value={fmt(P.mrr)} icon="🔁" color={COLORS.ckGanho}
              sub={P.ganho > 0 ? `MRR · ticket médio ${fmt(P.mrr / P.ganho)}/mês` : 'MRR das vendas fechadas'} />
            {pend ? <KpiCard title="Payback da verba" {...PEND} icon="⏱️" /> : (
              <KpiCard title="Payback da verba" icon="⏱️" color={COLORS.brandBlueMid}
                value={P.payback != null ? `${fmtNum(P.payback)} meses` : '—'}
                sub={P.roi1 != null ? `ROI no 1º mês: ${fmtNum(P.roi1)}x · CAC ${P.cac != null ? fmt(P.cac) : '—'}` : 'Sem venda fechada no período'} />)}
            <KpiCard title="Perdidos" value={P.perdido} icon="❌" color={COLORS.ckPerdido}
              sub={`${fmtPct(P.taxaPerda)} dos leads`} />
          </div>
          <p className="text-gray-500 text-xs mb-7">
            ℹ️ O valor de cada negócio no Cockpit é a <strong>mensalidade</strong> do plano. Payback = quantos meses de mensalidade
            das vendas fechadas pagam o investimento do período; ROI no 1º mês = (mensalidade − investimento) ÷ investimento.
          </p>

          {/* Etapas + conversão */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
            <Card className="lg:col-span-2" titulo="Onde estão os leads hoje"
              sub={`Etapa atual no Kanban do Cockpit (posição de ${fmtDataHora(COCKPIT.posicao_em)}) dos leads criados no período`}>
              <div className="space-y-2.5">
                {etapas.map(e => (
                  <div key={e.etapa}>
                    <div className="flex justify-between text-xs mb-1 gap-2">
                      <span className="text-gray-700 font-medium">
                        <span className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ background: COR_GRUPO[e.grupo] }} />
                        {e.etapa}
                      </span>
                      <span className="text-gray-600 whitespace-nowrap">
                        <strong className="text-gray-900">{e.n}</strong> ({fmtPct(P.total ? (e.n / P.total) * 100 : null)})
                        {e.valor > 0 && <> · {fmt(e.valor)}/mês</>}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full" style={{ width: `${(e.n / maxEtapa) * 100}%`, background: COR_GRUPO[e.grupo] }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-[11px] text-gray-500">
                {Object.entries(GRUPO_LABEL).filter(([g]) => g !== 'novo' || P.novo > 0).map(([g, t]) => (
                  <span key={g}><span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: COR_GRUPO[g] }} />{t}</span>
                ))}
              </div>
            </Card>

            <Card titulo="Conversão do período" sub="Safra: leads criados no período e até onde chegaram">
              <div className="space-y-3">
                {[
                  { t: 'Leads', v: P.total, c: COLORS.leads, s: null },
                  { t: 'Chegaram a demo / proposta (ou fecharam)', v: P.avancado + P.ganho, c: COLORS.ckAvancado, s: P.taxaAvanco },
                  { t: 'Vendas fechadas', v: P.ganho, c: COLORS.ckGanho, s: P.taxaVenda },
                ].map(x => (
                  <div key={x.t} className="rounded-xl border border-gray-100 bg-white/60 p-3">
                    <p className="text-gray-500 text-[11px] uppercase tracking-wider">{x.t}</p>
                    <p className="text-2xl font-black mt-1" style={{ color: x.c }}>
                      {x.v}{x.s != null && <span className="text-sm font-semibold text-gray-500"> · {fmtPct(x.s)}</span>}
                    </p>
                  </div>
                ))}
                <p className="text-gray-500 text-xs">
                  💬 <strong className="text-gray-700">{P.avancado}</strong> negócio(s) em demo/proposta/aguardando pagamento
                  {P.mrrNegociacao > 0 && <> somando <strong className="text-gray-700">{fmt(P.mrrNegociacao)}/mês</strong></>}.
                  {' '}<strong className="text-gray-700">{P.emAberto}</strong> leads seguem em aberto, então as vendas podem crescer.
                </p>
                <p className="text-gray-400 text-[11px]">
                  “Chegaram a demo/proposta” considera a etapa atual: um lead perdido depois da demo conta como perdido.
                </p>
              </div>
            </Card>
          </div>

          {/* Leads por dia */}
          <Card titulo="Leads por dia" sub="Data do cadastro (Bitrix) ou de criação do negócio no Cockpit, separados pela origem" className="mb-5">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={diario} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#6b7280' }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(51,116,181,0.06)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="conta"    name="Conta gratuita" stackId="a" fill={COLORS.ckConta} />
                <Bar dataKey="whatsapp" name="WhatsApp"       stackId="a" fill={COLORS.ckWhatsApp} />
                <Bar dataKey="outras"   name="Outras"         stackId="a" fill={COLORS.ckOutras} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Origem */}
          <Card titulo="Origem dos leads" sub="Coluna “Origem” do Cockpit. “Não informada” = negócio criado à mão sem origem." className="mb-5">
            <TabelaDesempenho linhas={origens} colunaNome="Origem" total={P.total} />
          </Card>

          {/* UTMs */}
          <Card className="mb-5" titulo="Desempenho por UTM — conta gratuita"
            sub={`UTMs do Bitrix, só para quem criou a conta gratuita (${comUtm} de ${P.contas} com UTM). Leads de WhatsApp não têm UTM.`}>
            <div className="flex flex-wrap gap-2 mb-4">
              {DIMENSOES_UTM.map(d => (
                <button key={d.key} onClick={() => setDim(d.key)} title={d.help}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${dim === d.key
                    ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-blue/40'}`}>
                  {d.label}
                </button>
              ))}
            </div>
            <TabelaDesempenho linhas={utm} colunaNome={dimAtual.label} total={P.contas} />
          </Card>

          {/* Responsáveis + segmento */}
          <Card className="mb-5" titulo="Por responsável" sub="Quem está atendendo os leads no Cockpit">
            <TabelaDesempenho linhas={resp} colunaNome="Responsável" total={P.total} />
          </Card>
          <Card titulo="Segmento informado no cadastro"
              sub={`Conta gratuita · ${P.mira} lead(s) (${fmtPct(P.contas ? (P.mira / P.contas) * 100 : null)}) marcaram interesse na IA Mira`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5">
                {segmentos.map(s => (
                  <div key={s.nome}>
                    <div className="flex justify-between text-xs mb-1 gap-2">
                      <span className="text-gray-600 truncate" title={s.nome}>{s.nome}</span>
                      <span className="text-brand-blue-light font-bold whitespace-nowrap">
                        {s.total}{s.ganho > 0 && <span className="text-green-600"> · {s.ganho} venda(s)</span>}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" style={{ width: `${(s.total / maxSeg) * 100}%`, background: COLORS.brandBlueLight }} />
                    </div>
                  </div>
                ))}
              </div>
          </Card>
        </>
      )}

      {/* Live de lançamento (Set/26) — bloco separado */}
      <BlocoLive />

      {/* Regras */}
      <div className="mt-5 p-4 rounded-xl border border-gray-200 bg-gray-50/60 text-xs text-gray-500 leading-relaxed">
        <p className="font-semibold text-gray-700 mb-1">Como esta aba é montada</p>
        <p>
          A planilha do Cockpit tem {R.planilha} negócios; {R.casados} foram casados com o cadastro no Bitrix (título e nome do contato)
          para trazer a data real e as UTMs. {R.testes} contas de teste foram excluídas (nome com “teste” ou com o nome de alguém do time).
          {R.sem_par > 0 && <> {R.sem_par} cadastro(s) do Bitrix sem negócio correspondente no Cockpit ficam de fora (a planilha é a base completa).</>}
          {' '}Não usamos “leads efetivos” nesta aba. O investimento do Cockpit sai do Total Investido do Grupo a partir de {COCKPIT_DESDE_LABEL}.
        </p>
      </div>
    </div>
  );
}
