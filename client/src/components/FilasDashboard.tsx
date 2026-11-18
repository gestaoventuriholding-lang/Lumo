import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AnimatedText } from "@/components/AnimatedNumber";
import ChangeBadge from "@/components/ChangeBadge";
import { motion, cardItemVariants, staggerContainerVariants, CHART_DRAW_MS } from "@/lib/motionVariants";
import { useFilasDiarias } from "@/hooks/useFilasDiarias";
import { describeChange, previousRange, type Change } from "@/lib/periodComparison";
import { janelaDeBusca, resumoFilas, serieAnalisesImagem } from "@/lib/filasMetrics";
import { formatAverageTime } from "@/lib/performanceStorage";
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
const tempo = (segundos?: number) => (segundos !== undefined && segundos > 0 ? formatAverageTime(segundos / 60) : "—");

function MetricCard({ title, value, detail, delta, testId }: { title: string; value: string; detail?: string; delta?: Change; testId: string }) {
  return (
    <motion.div variants={cardItemVariants} className="ellos-panel-sm p-5" data-testid={testId}>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="font-display mt-1 text-3xl font-bold text-foreground tabular-nums">
        <AnimatedText text={value} />
      </p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
      {delta ? <ChangeBadge change={delta} className="mt-1" /> : null}
    </motion.div>
  );
}

/**
 * Cartões de TMA, TME, Análises Clínicas, Diagnóstico por Imagem e Abandono, e o gráfico Análises × Imagem.
 * O TMA vem dos mesmos dados de atendimento do resto do Dashboard (recebido pronto); o resto vem das filas da Escallo.
 */
export default function FilasDashboard({
  range,
  tmaMinutos,
  tmaAnteriorMinutos,
}: {
  range: DateRange;
  tmaMinutos: number;
  tmaAnteriorMinutos: number;
}) {
  const anterior = useMemo(() => previousRange(range), [range]);
  const janela = janelaDeBusca(range, anterior);
  const { rows, carregado } = useFilasDiarias(janela.start, janela.end);

  const atual = useMemo(() => resumoFilas(rows, range), [rows, range]);
  const antes = useMemo(() => resumoFilas(rows, anterior), [rows, anterior]);
  const serie = useMemo(() => serieAnalisesImagem(rows, range), [rows, range]);

  const comparar = (a?: number, b?: number, lowerIsBetter = false, unit?: "points") =>
    describeChange(a ?? 0, b ?? 0, anterior.name, { lowerIsBetter, unit });

  const detalheTme =
    atual.tmeLigacao !== undefined || atual.tmeWhatsapp !== undefined
      ? `Ligação ${tempo(atual.tmeLigacao)} · WhatsApp ${tempo(atual.tmeWhatsapp)}`
      : undefined;
  const semFila = carregado && !atual.temDados;

  return (
    <div className="space-y-4" data-testid="filas-dashboard">
      <motion.div variants={staggerContainerVariants} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          testId="cartao-tma"
          title="TMA"
          value={tmaMinutos > 0 ? formatAverageTime(tmaMinutos) : "—"}
          delta={comparar(tmaMinutos, tmaAnteriorMinutos, true)}
        />
        <MetricCard
          testId="cartao-tme"
          title="TME (tempo médio de espera)"
          value={tempo(atual.tmeGeral)}
          detail={detalheTme}
          delta={comparar(atual.tmeGeral, antes.tmeGeral, true)}
        />
        <MetricCard
          testId="cartao-analises"
          title="Análises Clínicas"
          value={atual.analises > 0 ? formatCount(atual.analises) : "—"}
          detail="ligações atendidas"
          delta={comparar(atual.analises, antes.analises)}
        />
        <MetricCard
          testId="cartao-imagem"
          title="Diagnóstico por Imagem"
          value={atual.imagem > 0 ? formatCount(atual.imagem) : "—"}
          detail="ligações atendidas"
          delta={comparar(atual.imagem, antes.imagem)}
        />
        <MetricCard
          testId="cartao-abandono"
          title="Abandono"
          value={atual.abandonoPct !== undefined ? `${atual.abandonoPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}
          detail={atual.ligacoesAbandonadas > 0 ? `${formatCount(atual.ligacoesAbandonadas)} ligações abandonadas` : "ligações"}
          delta={comparar(atual.abandonoPct, antes.abandonoPct, true, "points")}
        />
      </motion.div>

      <div className="ellos-panel-sm p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">Análises × Imagem</h2>
          <p className="text-xs text-muted-foreground">Ligações atendidas por fila. O WhatsApp não tem fila de Análises, então não entra aqui.</p>
        </div>
        {serie.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground" data-testid="filas-vazio">
            {semFila ? "Sem dados de fila neste período." : "Carregando…"}
          </p>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap gap-4 text-xs text-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: chartColors.series[0] }} />
                Análises Clínicas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: chartColors.series[1] }} />
                Diagnóstico por Imagem
              </span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serie} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="label" {...chartAxisProps} interval="preserveStartEnd" minTickGap={16} />
                  <YAxis {...chartAxisProps} width={44} tickFormatter={(v: number) => v.toLocaleString("pt-BR")} />
                  <Tooltip cursor={chartCursor} contentStyle={chartTooltipContentStyle} formatter={(v: number, nome: string) => [formatCount(v), nome]} />
                  <Bar dataKey="analises" name="Análises Clínicas" fill={chartColors.series[0]} maxBarSize={28} radius={chartBarRadius} isAnimationActive animationDuration={CHART_DRAW_MS} />
                  <Bar dataKey="imagem" name="Diagnóstico por Imagem" fill={chartColors.series[1]} maxBarSize={28} radius={chartBarRadius} isAnimationActive animationDuration={CHART_DRAW_MS} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
