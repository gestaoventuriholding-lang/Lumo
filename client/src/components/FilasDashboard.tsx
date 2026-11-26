import { useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Hourglass, Timer, TrendingUp } from "lucide-react";
import { AnimatedText } from "@/components/AnimatedNumber";
import ChangeBadge from "@/components/ChangeBadge";
import DashboardKpiCard from "@/components/DashboardKpiCard";
import { motion, cardItemVariants, staggerContainerVariants, CHART_DRAW_MS } from "@/lib/motionVariants";
import { useFilasDiarias } from "@/hooks/useFilasDiarias";
import { describeChange, previousRange, type Change } from "@/lib/periodComparison";
import { IA_FTOKENS_CONTRATADOS, franquiaDoMes, janelaDeBusca, mesDaData, resumoExames, resumoFilas, resumoIA, serieExames } from "@/lib/filasMetrics";
import { useConsumoIA } from "@/hooks/useConsumoIA";
import { useEscolhasExames } from "@/hooks/useEscolhasExames";
import { formatAverageTime } from "@/lib/performanceStorage";
import type { AverageTimeByChannel } from "@/lib/performanceMetrics";
import { cn } from "@/lib/utils";
import {
  chartAxisProps,
  chartBarRadius,
  chartColors,
  chartCursor,
  chartGridProps,
  chartTooltipContentStyle,
} from "@/lib/chartTheme";
import type { DateRange } from "@/lib/dateRangeFilter";

const formatCount = (v: number) => v.toLocaleString("pt-BR");
const formatDecimal = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tempo = (segundos?: number) => (segundos !== undefined && segundos > 0 ? formatAverageTime(segundos / 60) : "—");

/** Os 3 exames, na mesma ordem do relatório da Escallo (REL092): imagem, laboratoriais, cardiológicos */
const EXAMES = [
  { chave: "imagem", nome: "Exames por imagem", cor: chartColors.exames[1] },
  { chave: "analises", nome: "Exames laboratoriais", cor: chartColors.exames[0] },
  { chave: "cardiologicos", nome: "Exames cardiológicos", cor: chartColors.exames[2] },
] as const;

type VisaoExames = "total" | "dia";

type CanalTma = "todos" | "whatsapp" | "ligacao";

/** Escolhe o canal (TMA ou TME): o WhatsApp e a Ligação têm tempos bem diferentes, então dá para ver cada um separado */
function SeletorCanalTma({ valor, onChange, nome = "tma" }: { valor: CanalTma; onChange: (v: CanalTma) => void; nome?: "tma" | "tme" }) {
  const opcoes: { v: CanalTma; rotulo: string }[] = [
    { v: "todos", rotulo: "Todos" },
    { v: "whatsapp", rotulo: "WhatsApp" },
    { v: "ligacao", rotulo: "Ligação" },
  ];
  return (
    <div role="group" aria-label={`Canal do ${nome.toUpperCase()}`} className="inline-flex items-center gap-0.5" data-testid={`canal-${nome}`}>
      {opcoes.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={valor === o.v}
          data-testid={`canal-${nome}-${o.v}`}
          onClick={() => onChange(o.v)}
          className={cn(
            "rounded-md px-2 py-0.5 text-xs transition-colors",
            valor === o.v ? "bg-primary-soft font-semibold text-primary" : "font-medium text-muted-foreground hover:text-foreground"
          )}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

export interface SubCartao {
  testId: string;
  title: string;
  value: string;
  detail?: string;
  legenda?: string;
  delta?: Change;
}

/** Subcartão: menor que os 4 cartões grandes do topo */
function SubCartaoView({ title, value, detail, legenda, delta, testId }: SubCartao) {
  return (
    <motion.div variants={cardItemVariants} className="ellos-panel-sm px-4 py-3" data-testid={testId}>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className="font-display mt-0.5 text-2xl font-bold text-foreground tabular-nums">
        <AnimatedText text={value} />
      </p>
      {detail ? <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p> : null}
      {legenda ? <p className="mt-0.5 text-xs text-muted-foreground">{legenda}</p> : null}
      {delta ? <ChangeBadge change={delta} className="mt-1" /> : null}
    </motion.div>
  );
}

const LEGENDA_FILA = "todas as ligações da fila";

/**
 * Parte de cima do Dashboard: 4 cartões grandes do mesmo tamanho (Colaboradores, Atendimentos, TMA, TME), subcartões menores
 * (Meta, Ausências, os 3 exames da URA, Outras e Abandono) e o gráfico dos 3 exames.
 * Atendimentos e TMA vêm dos mesmos dados de atendimento do resto do Dashboard (recebidos prontos); o resto vem das filas da Escallo.
 */
export default function FilasDashboard({
  range,
  colaboradores,
  subcartoesIniciais,
  tma,
  tmaAnterior,
  atendimentos,
  atendimentosAnterior,
  atendimentosSpark,
}: {
  range: DateRange;
  /** Cartão grande de Colaboradores (montado pelo Dashboard) */
  colaboradores: ReactNode;
  /** Subcartões que já existiam (Meta, Ausências): vêm antes dos de fila */
  subcartoesIniciais: SubCartao[];
  /** TMA em minutos do período e do período anterior, total e por canal */
  tma: AverageTimeByChannel;
  tmaAnterior: AverageTimeByChannel;
  /** Atendimentos do período (Ligação + WhatsApp) */
  atendimentos: { total: number; ligacao: number; whatsapp: number };
  atendimentosAnterior: number;
  atendimentosSpark: { v: number }[];
}) {
  const anterior = useMemo(() => previousRange(range), [range]);
  const [canalTma, setCanalTma] = useState<CanalTma>("todos");
  const [canalTme, setCanalTme] = useState<CanalTma>("todos");
  const [visaoExames, setVisaoExames] = useState<VisaoExames>("total");
  const tmaMinutos = tma[canalTma === "todos" ? "total" : canalTma];
  const tmaAnteriorMinutos = tmaAnterior[canalTma === "todos" ? "total" : canalTma];
  const janela = janelaDeBusca(range, anterior);
  const { rows } = useFilasDiarias(janela.start, janela.end);

  // O consumo de IA também precisa do mês inteiro até o fim do período, para mostrar quanto da franquia de 5.000 FTokens já foi usada
  const inicioIA = [janela.start, mesDaData(range.end).start].sort()[0];
  const iaRows = useConsumoIA(inicioIA, janela.end);
  const iaAtual = useMemo(() => resumoIA(iaRows, range), [iaRows, range]);
  const iaAntes = useMemo(() => resumoIA(iaRows, anterior), [iaRows, anterior]);
  const franquia = useMemo(() => franquiaDoMes(iaRows, range), [iaRows, range]);

  const atual = useMemo(() => resumoFilas(rows, range), [rows, range]);
  const antes = useMemo(() => resumoFilas(rows, anterior), [rows, anterior]);
  // Exames: quantas vezes cada opção foi escolhida no menu principal do WhatsApp (rel092)
  const { rows: escolhas, carregado: escolhasCarregadas } = useEscolhasExames(janela.start, janela.end);
  const exames = useMemo(() => resumoExames(escolhas, range), [escolhas, range]);
  const examesAntes = useMemo(() => resumoExames(escolhas, anterior), [escolhas, anterior]);
  const serie = useMemo(() => serieExames(escolhas, range), [escolhas, range]);
  const totaisExames = EXAMES.map((e) => ({ nome: e.nome, valor: exames[e.chave], cor: e.cor }));

  const comparar = (a?: number, b?: number, lowerIsBetter = false, unit?: "points") =>
    describeChange(a ?? 0, b ?? 0, anterior.name, { lowerIsBetter, unit });

  const tmeEscolhido = (r: { tmeGeral?: number; tmeLigacao?: number; tmeWhatsapp?: number }) =>
    canalTme === "todos" ? r.tmeGeral : canalTme === "whatsapp" ? r.tmeWhatsapp : r.tmeLigacao;
  const detalheTme =
    atual.tmeLigacao !== undefined || atual.tmeWhatsapp !== undefined
      ? `Ligação ${tempo(atual.tmeLigacao)} · WhatsApp ${tempo(atual.tmeWhatsapp)}`
      : "Sem dados de fila no período";
  const ic = { iconBg: "bg-primary-soft", iconColor: "text-primary", sparkColor: chartColors.primary, trend: "neutral" as const };

  const exame = (testId: string, title: string, valor: number, anteriorValor: number): SubCartao => ({
    testId,
    title,
    value: valor > 0 ? formatCount(valor) : "—",
    detail: "vezes que a opção foi escolhida",
    legenda: "menu principal do WhatsApp",
    // sem dado no período anterior não há com o que comparar
    delta: anteriorValor > 0 ? comparar(valor, anteriorValor) : undefined,
  });
  const subcartoes: SubCartao[] = [
    ...subcartoesIniciais,
    exame("cartao-analises", "Exames laboratoriais", exames.analises, examesAntes.analises),
    exame("cartao-imagem", "Exames por imagem", exames.imagem, examesAntes.imagem),
    exame("cartao-cardiologicos", "Exames cardiológicos", exames.cardiologicos, examesAntes.cardiologicos),
    {
      testId: "cartao-outras",
      title: "Outras filas",
      value: atual.outras > 0 ? formatCount(atual.outras) : "—",
      detail: "ligações atendidas",
      legenda: "filas que não são de exame",
      delta: comparar(atual.outras, antes.outras),
    },
    {
      testId: "cartao-abandono",
      title: "Abandono",
      value: atual.abandonoPct !== undefined ? `${atual.abandonoPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—",
      detail: atual.ligacoesAbandonadas > 0 ? `${formatCount(atual.ligacoesAbandonadas)} ligações abandonadas` : "ligações",
      legenda: LEGENDA_FILA,
      delta: comparar(atual.abandonoPct, antes.abandonoPct, true, "points"),
    },
    {
      testId: "cartao-consumo-ia",
      title: "Consumo de IA (FTokens)",
      value: iaAtual.ftokens > 0 ? formatDecimal(iaAtual.ftokens) : "—",
      detail:
        iaAtual.mediaPorContato !== undefined
          ? `${formatCount(iaAtual.contatos)} contatos · ${formatDecimal(iaAtual.mediaPorContato)} por contato`
          : "FTokens de contatos",
      legenda:
        franquia.usado > 0
          ? `mês: ${formatDecimal(franquia.usado)} de ${formatCount(IA_FTOKENS_CONTRATADOS)} contratados (${franquia.pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)${franquia.esgotada ? " · franquia esgotada" : ""}`
          : `${formatCount(IA_FTOKENS_CONTRATADOS)} contratados por mês`,
      delta: comparar(iaAtual.ftokens, iaAntes.ftokens, true),
    },
  ];

  return (
    <div className="space-y-4" data-testid="filas-dashboard">
      <motion.div variants={staggerContainerVariants} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="cartoes-grandes">
        {colaboradores}
        <DashboardKpiCard
          title="Atendimentos"
          value={atendimentos.total > 0 ? formatCount(atendimentos.total) : "—"}
          comparison={atendimentos.total > 0 ? `Ligação ${formatCount(atendimentos.ligacao)} · WhatsApp ${formatCount(atendimentos.whatsapp)}` : "Sem registros no período"}
          footnote="inclui Confirmação de agenda; sem a Triagem"
          delta={comparar(atendimentos.total, atendimentosAnterior)}
          icon={TrendingUp}
          sparkData={atendimentosSpark}
          {...ic}
        />
        <DashboardKpiCard
          title="TMA (tempo médio de atendimento)"
          value={tmaMinutos > 0 ? formatAverageTime(tmaMinutos) : "—"}
          comparison={canalTma === "todos" ? "Ligação e WhatsApp" : canalTma === "whatsapp" ? "Só WhatsApp" : "Só Ligação"}
          controles={<SeletorCanalTma valor={canalTma} onChange={setCanalTma} />}
          footnote="equipe do call center"
          delta={comparar(tmaMinutos, tmaAnteriorMinutos, true)}
          icon={Timer}
          sparkData={[]}
          {...ic}
        />
        <DashboardKpiCard
          title="TME (tempo médio de espera)"
          value={tempo(tmeEscolhido(atual))}
          comparison={canalTme === "todos" ? detalheTme : canalTme === "whatsapp" ? "Só WhatsApp" : "Só Ligação"}
          controles={<SeletorCanalTma nome="tme" valor={canalTme} onChange={setCanalTme} />}
          footnote={LEGENDA_FILA}
          delta={comparar(tmeEscolhido(atual), tmeEscolhido(antes), true)}
          icon={Hourglass}
          sparkData={[]}
          {...ic}
        />
      </motion.div>

      <motion.div variants={staggerContainerVariants} className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="subcartoes">
        {subcartoes.map((c) => (
          <SubCartaoView key={c.testId} {...c} />
        ))}
      </motion.div>

      <div className="ellos-panel-sm p-5" data-testid="grafico-exames">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">Exames por área</h2>
            <p className="text-xs text-muted-foreground">
              Quantas vezes cada tipo de exame foi escolhido no menu principal do WhatsApp (REL092 da Escallo). Ligações não entram aqui.
            </p>
          </div>
          <div role="group" aria-label="Visão do gráfico de exames" className="inline-flex items-center gap-0.5">
            {([["total", "Total"], ["dia", "Por dia"]] as const).map(([v, rotulo]) => (
              <button
                key={v}
                type="button"
                aria-pressed={visaoExames === v}
                data-testid={`visao-exames-${v}`}
                onClick={() => setVisaoExames(v)}
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs transition-colors",
                  visaoExames === v ? "bg-primary-soft font-semibold text-primary" : "font-medium text-muted-foreground hover:text-foreground"
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>
        {serie.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground" data-testid="filas-vazio">
            {escolhasCarregadas ? "Sem escolhas de exame neste período." : "Carregando…"}
          </p>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap gap-4 text-xs text-foreground">
              {EXAMES.map((e) => (
                <span key={e.chave} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: e.cor }} />
                  {e.nome}
                </span>
              ))}
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {visaoExames === "total" ? (
                  <BarChart data={totaisExames} margin={{ top: 24, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid {...chartGridProps} />
                    <XAxis dataKey="nome" {...chartAxisProps} interval={0} />
                    <YAxis {...chartAxisProps} width={44} tickFormatter={(v: number) => v.toLocaleString("pt-BR")} />
                    <Tooltip cursor={chartCursor} contentStyle={chartTooltipContentStyle} formatter={(v: number) => [formatCount(v), "Vezes escolhido"]} />
                    <Bar dataKey="valor" maxBarSize={160} radius={chartBarRadius} isAnimationActive animationDuration={CHART_DRAW_MS}>
                      {totaisExames.map((t) => (
                        <Cell key={t.nome} fill={t.cor} />
                      ))}
                      <LabelList dataKey="valor" position="top" formatter={(v: number) => formatCount(v)} className="fill-foreground text-xs font-semibold tabular-nums" />
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart data={serie} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid {...chartGridProps} />
                    <XAxis dataKey="label" {...chartAxisProps} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis {...chartAxisProps} width={44} tickFormatter={(v: number) => v.toLocaleString("pt-BR")} />
                    <Tooltip cursor={chartCursor} contentStyle={chartTooltipContentStyle} formatter={(v: number, nome: string) => [formatCount(v), nome]} />
                    {EXAMES.map((e) => (
                      <Bar key={e.chave} dataKey={e.chave} name={e.nome} fill={e.cor} maxBarSize={28} radius={chartBarRadius} isAnimationActive animationDuration={CHART_DRAW_MS} />
                    ))}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
