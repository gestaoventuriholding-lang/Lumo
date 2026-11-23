import { useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Hourglass, Timer, TrendingUp } from "lucide-react";
import { AnimatedText } from "@/components/AnimatedNumber";
import ChangeBadge from "@/components/ChangeBadge";
import DashboardKpiCard from "@/components/DashboardKpiCard";
import { motion, cardItemVariants, staggerContainerVariants, CHART_DRAW_MS } from "@/lib/motionVariants";
import { useFilasDiarias } from "@/hooks/useFilasDiarias";
import { describeChange, previousRange, type Change } from "@/lib/periodComparison";
import { IA_FTOKENS_CONTRATADOS, franquiaDoMes, janelaDeBusca, mesDaData, resumoFilas, resumoIA, serieExames } from "@/lib/filasMetrics";
import { useConsumoIA } from "@/hooks/useConsumoIA";
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

type CanalTma = "todos" | "whatsapp" | "ligacao";

/** Escolhe o canal do TMA: o WhatsApp e a Ligação têm tempos bem diferentes, então dá para ver cada um separado */
function SeletorCanalTma({ valor, onChange }: { valor: CanalTma; onChange: (v: CanalTma) => void }) {
  const opcoes: { v: CanalTma; rotulo: string }[] = [
    { v: "todos", rotulo: "Todos" },
    { v: "whatsapp", rotulo: "WhatsApp" },
    { v: "ligacao", rotulo: "Ligação" },
  ];
  return (
    <div role="group" aria-label="Canal do TMA" className="inline-flex rounded-md border border-border p-0.5" data-testid="canal-tma">
      {opcoes.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={valor === o.v}
          data-testid={`canal-tma-${o.v}`}
          onClick={() => onChange(o.v)}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            valor === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
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
  const tmaMinutos = tma[canalTma === "todos" ? "total" : canalTma];
  const tmaAnteriorMinutos = tmaAnterior[canalTma === "todos" ? "total" : canalTma];
  const janela = janelaDeBusca(range, anterior);
  const { rows, carregado } = useFilasDiarias(janela.start, janela.end);

  // O consumo de IA também precisa do mês inteiro até o fim do período, para mostrar quanto da franquia de 5.000 FTokens já foi usada
  const inicioIA = [janela.start, mesDaData(range.end).start].sort()[0];
  const iaRows = useConsumoIA(inicioIA, janela.end);
  const iaAtual = useMemo(() => resumoIA(iaRows, range), [iaRows, range]);
  const iaAntes = useMemo(() => resumoIA(iaRows, anterior), [iaRows, anterior]);
  const franquia = useMemo(() => franquiaDoMes(iaRows, range), [iaRows, range]);

  const atual = useMemo(() => resumoFilas(rows, range), [rows, range]);
  const antes = useMemo(() => resumoFilas(rows, anterior), [rows, anterior]);
  const serie = useMemo(() => serieExames(rows, range), [rows, range]);

  const comparar = (a?: number, b?: number, lowerIsBetter = false, unit?: "points") =>
    describeChange(a ?? 0, b ?? 0, anterior.name, { lowerIsBetter, unit });

  const detalheTme =
    atual.tmeLigacao !== undefined || atual.tmeWhatsapp !== undefined
      ? `Ligação ${tempo(atual.tmeLigacao)} · WhatsApp ${tempo(atual.tmeWhatsapp)}`
      : "Sem dados de fila no período";
  const semFila = carregado && !atual.temDados;
  const ic = { iconBg: "bg-primary-soft", iconColor: "text-primary", sparkColor: chartColors.primary, trend: "neutral" as const };

  const exame = (testId: string, title: string, valor: number, anteriorValor: number): SubCartao => ({
    testId,
    title,
    value: valor > 0 ? formatCount(valor) : "—",
    detail: "ligações atendidas",
    legenda: LEGENDA_FILA,
    delta: comparar(valor, anteriorValor),
  });
  const subcartoes: SubCartao[] = [
    ...subcartoesIniciais,
    exame("cartao-analises", "Exames laboratoriais", atual.analises, antes.analises),
    exame("cartao-imagem", "Exames por imagem", atual.imagem, antes.imagem),
    exame("cartao-cardiologicos", "Exames cardiológicos", atual.cardiologicos, antes.cardiologicos),
    exame("cartao-outras", "Outras", atual.outras, antes.outras),
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
          footnote="equipe do call center"
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
          value={tempo(atual.tmeGeral)}
          comparison={detalheTme}
          footnote={LEGENDA_FILA}
          delta={comparar(atual.tmeGeral, antes.tmeGeral, true)}
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

      <div className="ellos-panel-sm p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">Exames por área</h2>
          <p className="text-xs text-muted-foreground">
            Ligações atendidas por fila da URA. “Outras” (Orçamento, Falar com Atendente…) ficam só no cartão. O WhatsApp não tem fila por exame, então não entra aqui.
          </p>
        </div>
        {serie.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground" data-testid="filas-vazio">
            {semFila ? "Sem dados de fila neste período." : "Carregando…"}
          </p>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap gap-4 text-xs text-foreground">
              {["Exames laboratoriais", "Exames por imagem", "Exames cardiológicos"].map((nome, i) => (
                <span key={nome} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: chartColors.exames[i] }} />
                  {nome}
                </span>
              ))}
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serie} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="label" {...chartAxisProps} interval="preserveStartEnd" minTickGap={16} />
                  <YAxis {...chartAxisProps} width={44} tickFormatter={(v: number) => v.toLocaleString("pt-BR")} />
                  <Tooltip cursor={chartCursor} contentStyle={chartTooltipContentStyle} formatter={(v: number, nome: string) => [formatCount(v), nome]} />
                  <Bar dataKey="analises" name="Exames laboratoriais" fill={chartColors.exames[0]} maxBarSize={28} radius={chartBarRadius} isAnimationActive animationDuration={CHART_DRAW_MS} />
                  <Bar dataKey="imagem" name="Exames por imagem" fill={chartColors.exames[1]} maxBarSize={28} radius={chartBarRadius} isAnimationActive animationDuration={CHART_DRAW_MS} />
                  <Bar dataKey="cardiologicos" name="Exames cardiológicos" fill={chartColors.exames[2]} maxBarSize={28} radius={chartBarRadius} isAnimationActive animationDuration={CHART_DRAW_MS} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
