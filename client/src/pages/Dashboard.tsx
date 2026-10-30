import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion, pageContainerVariants, pageItemVariants, staggerContainerVariants, CHART_DRAW_MS } from "@/lib/motionVariants";
import AnimatedNumber from "@/components/AnimatedNumber";
import { mergePeriodTotals } from "@/lib/periodTotals";
import { Users, TrendingUp, Target, AlertCircle, Download, ArrowRight, Trophy } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import ExportModal from "@/components/ExportModal";
import ManagementReportButton from "@/components/ManagementReportButton";
import DetailedAnalysisSummary from "@/components/DetailedAnalysisSummary";
import PeriodFilterBar from "@/components/PeriodFilterBar";
import PeriodTotalsNotice from "@/components/PeriodTotalsNotice";
import { describeChange, previousRange } from "@/lib/periodComparison";
import DashboardKpiCard from "@/components/DashboardKpiCard";
import { usePeriodFilter } from "@/contexts/PeriodFilterContext";
import {
  buildAttendantSummaries,
  buildAttendancesTrend,
  buildChannelAttendanceTotals,
  buildChannelDistribution,
  buildDashboardStats,
  buildProductivityTrend,
} from "@/lib/performanceMetrics";
import { useLumoData } from "@/contexts/LumoDataContext";
import { totalAbsenceDaysInRange } from "@/lib/absenceMetrics";
import {
  periodAttendancesLabel,
  periodMetaLabel,
  periodScopePhrase,
} from "@/lib/dateRangeFilter";
import { buildDetailedAnalysisReport } from "@/lib/detailedAnalysisSummary";
import { loadAnalysisNote } from "@/lib/analysisNoteStorage";
import { chartTooltipContentStyle } from "@/lib/alertColors";

function EmptySection({ message }: { message: string }) {
  return (
    <p className="py-10 text-center text-sm text-muted-foreground">{message}</p>
  );
}

const CHANNEL_SERIES = [
  { key: "ligacao", label: "Ligação", color: "#3b82f6" },
  { key: "whatsapp", label: "WhatsApp", color: "#10b981" },
] as const;

type TrendPoint = ReturnType<typeof buildAttendancesTrend>[number];

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: TrendPoint }[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div style={chartTooltipContentStyle} className="min-w-44 space-y-1.5 px-3 py-2 text-sm">
      <p className="font-semibold text-foreground">{point.label}</p>
      {CHANNEL_SERIES.map((series) => (
        <p key={series.key} className="flex items-center justify-between gap-4 text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: series.color }} />
            {series.label}
          </span>
          <span className="font-medium tabular-nums text-foreground">
            {point[series.key].toLocaleString("pt-BR")}
          </span>
        </p>
      ))}
      <p className="flex justify-between gap-4 border-t border-border/60 pt-1.5 font-semibold text-foreground">
        <span>Total</span>
        <span className="tabular-nums">{point.attendances.toLocaleString("pt-BR")}</span>
      </p>
    </div>
  );
}

/** Volume por dia, empilhado por canal: barras mostram quantidade; canal sem dados no período some */
function AttendancesTrendChart({ data }: { data: TrendPoint[] }) {
  const visible = CHANNEL_SERIES.filter((series) => data.some((point) => point[series.key] > 0));
  const hidden = CHANNEL_SERIES.filter((series) => !visible.includes(series));
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {visible.map((series) => (
          <span key={series.key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: series.color }} />
            {series.label}
          </span>
        ))}
        {hidden.length > 0 && (
          <span className="text-xs">Sem registros de {hidden.map((s) => s.label).join(" e ")} no período</span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={(v: number) => v.toLocaleString("pt-BR")}
          />
          <Tooltip content={<TrendTooltip />} cursor={{ fill: "rgba(51,102,255,0.08)" }} />
          {visible.map((series, index) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              stackId="canais"
              fill={series.color}
              maxBarSize={48}
              stroke="var(--card, #fff)"
              strokeWidth={index > 0 ? 2 : 0}
              radius={index === visible.length - 1 ? [4, 4, 0, 0] : 0}
              isAnimationActive
              animationDuration={CHART_DRAW_MS}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function toSparkData(values: number[]) {
  return values.map((v) => ({ v }));
}

export default function Dashboard() {
  const [showExportModal, setShowExportModal] = useState(false);
  const [analysisNote, setAnalysisNote] = useState(() => loadAnalysisNote());
  const { period, dateRange } = usePeriodFilter();

  const { attendants, performanceRecords: dailyRecords, productivityRecords, absences, productionGoals } = useLumoData();
  // totais de período de relatórios (sem dia a dia) entram quando cabem no filtro
  const performanceRecords = useMemo(
    () => mergePeriodTotals(dailyRecords, productivityRecords, dateRange),
    [dailyRecords, productivityRecords, dateRange]
  );

  const dashboardStats = useMemo(
    () => buildDashboardStats(attendants, performanceRecords, productionGoals, dateRange),
    [attendants, performanceRecords, productionGoals, dateRange]
  );

  const channelTotals = useMemo(
    () => buildChannelAttendanceTotals(performanceRecords, dateRange),
    [performanceRecords, dateRange]
  );

  const attendancesTrend = useMemo(
    () => buildAttendancesTrend(performanceRecords, dateRange),
    [performanceRecords, dateRange]
  );

  const productivityTrend = useMemo(
    () => buildProductivityTrend(performanceRecords, attendants, productionGoals, dateRange),
    [performanceRecords, attendants, productionGoals, dateRange]
  );

  const channelDistribution = useMemo(
    () => buildChannelDistribution(performanceRecords, dateRange),
    [performanceRecords, dateRange]
  );

  const totalAbsenceDays = useMemo(
    () => totalAbsenceDaysInRange(absences, dateRange),
    [absences, dateRange]
  );

  const detailedAnalysis = useMemo(
    () =>
      buildDetailedAnalysisReport(
        performanceRecords,
        attendants,
        productionGoals,
        absences,
        dateRange,
        periodScopePhrase(period),
        analysisNote
      ),
    [
      performanceRecords,
      attendants,
      productionGoals,
      absences,
      dateRange,
      period,
      analysisNote,
    ]
  );

  const previous = useMemo(() => {
    const range = previousRange(dateRange);
    const records = mergePeriodTotals(dailyRecords, productivityRecords, range);
    return {
      name: range.name,
      stats: buildDashboardStats(attendants, records, productionGoals, { ...range }),
    };
  }, [dailyRecords, productivityRecords, attendants, productionGoals, dateRange]);

  const channelTotal = channelDistribution.reduce((sum, item) => sum + item.value, 0);
  const formatCount = (value: number) => value.toLocaleString("pt-BR");

  const attendanceSpark = toSparkData(attendancesTrend.map((p) => p.attendances));
  const productivitySpark = toSparkData(productivityTrend.map((p) => p.productivity));

  const mainCards = [
    {
      title: "Total de Colaboradores",
      value: String(dashboardStats.totalAttendants),
      comparison: `${attendants.length} cadastrados no sistema`,
      trend: "neutral" as const,
      icon: Users,
      iconBg: "bg-blue-50 dark:bg-blue-500/15",
      iconColor: "text-blue-600 dark:text-blue-400",
      sparkColor: "#3b82f6",
      sparkData: attendanceSpark,
    },
    {
      title: periodAttendancesLabel(period),
      value: channelTotals.total > 0 ? formatCount(channelTotals.total) : "—",
      comparison:
        channelTotals.total > 0
          ? `${formatCount(channelTotals.ligacao)} Ligação · ${formatCount(channelTotals.whatsapp)} WhatsApp`
          : "Sem registros no período",
      footnote: `${dashboardStats.attendantsWithRecords} colaboradores com registros`,
      delta: describeChange(channelTotals.total, previous.stats.totalAttendances, previous.name),
      trend: "up" as const,
      icon: TrendingUp,
      iconBg: "bg-emerald-50 dark:bg-emerald-500/15",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      sparkColor: "#10b981",
      sparkData: attendanceSpark,
    },
    {
      title: periodMetaLabel(period),
      value:
        dashboardStats.averagePercentage > 0
          ? `${dashboardStats.averagePercentage.toFixed(0)}%`
          : "—",
      comparison: "média de atingimento da equipe",
      delta: describeChange(
        dashboardStats.averagePercentage,
        previous.stats.averagePercentage,
        previous.name,
        { unit: "points" }
      ),
      trend: dashboardStats.averagePercentage >= 85 ? ("up" as const) : ("down" as const),
      icon: Target,
      iconBg: "bg-violet-50 dark:bg-violet-500/15",
      iconColor: "text-violet-600 dark:text-violet-400",
      sparkColor: "#8b5cf6",
      sparkData: productivitySpark,
    },
    {
      title: "Dias de Ausência",
      value: totalAbsenceDays > 0 ? String(totalAbsenceDays) : "—",
      comparison: "total no período selecionado",
      trend: totalAbsenceDays > 0 ? ("down" as const) : ("neutral" as const),
      icon: AlertCircle,
      iconBg: "bg-orange-50 dark:bg-orange-500/15",
      iconColor: "text-orange-600 dark:text-orange-400",
      sparkColor: "#f97316",
      sparkData: [],
    },
  ];

  const lastUpdated = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <motion.div
      className="space-y-6 pb-8"
      variants={pageContainerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div
        variants={pageItemVariants}
        className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Visão rápida do período: totais, evolução e canais. O detalhe por pessoa fica em Desempenho
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <ManagementReportButton variant="outline" className="gap-2 bg-card" />
          <Button variant="outline" onClick={() => setShowExportModal(true)} className="gap-2 bg-card">
            <Download className="h-4 w-4" />
            Exportar Dados
          </Button>
        </div>
      </motion.div>

      <motion.div variants={pageItemVariants}>
        <PeriodFilterBar showScopeHint={false} />
      </motion.div>

      <PeriodTotalsNotice range={dateRange} />

      <motion.div
        variants={staggerContainerVariants}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {mainCards.map((card) => (
          <DashboardKpiCard key={card.title} {...card} />
        ))}
      </motion.div>

      <motion.div variants={pageItemVariants} className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="lumo-panel-sm p-5 xl:col-span-2">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-foreground">Evolução de Atendimentos</h2>
              <p className="text-sm text-muted-foreground">Volume diário por canal no período</p>
            </div>
          </div>
          {attendancesTrend.length > 0 ? (
            <AttendancesTrendChart data={attendancesTrend} />
          ) : (
            <EmptySection message="Registre atendimentos em Desempenho para visualizar a evolução." />
          )}
        </div>

        <div className="lumo-panel-sm p-5">
          <div className="mb-2">
            <h2 className="text-base font-bold text-foreground">Distribuição por Canal</h2>
            <p className="text-sm text-muted-foreground">Ligação e WhatsApp no período</p>
          </div>
          {channelDistribution.length > 0 ? (
            <div className="relative">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={channelDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {channelDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, _name, item) => [
                      `${value.toLocaleString("pt-BR")} atend.`,
                      item.payload.name,
                    ]}
                    contentStyle={chartTooltipContentStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-6">
                <p className="text-2xl font-bold text-foreground"><AnimatedNumber value={channelTotal} /></p>
                <p className="text-xs text-muted-foreground">total</p>
              </div>
              <div className="space-y-2">
                {channelDistribution.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate text-muted-foreground">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">{formatCount(item.value)}</p>
                      <p className="text-xs text-muted-foreground">
                        {channelTotal > 0 ? Math.round((item.value / channelTotal) * 100) : 0}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptySection message="Sem dados de canal no período selecionado." />
          )}
        </div>
      </motion.div>

      <motion.div variants={pageItemVariants}>
        <Link
          href="/performance"
          className="lumo-panel-sm group flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/30"
        >
          <span className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-amber-500" />
            <span>
              <span className="block text-sm font-semibold text-foreground">Ranking e produtividade por colaboradora</span>
              <span className="block text-xs text-muted-foreground">Veja quem mais atendeu, a meta e o TMA em Desempenho</span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      </motion.div>

      <motion.details variants={pageItemVariants} className="lumo-panel-sm overflow-hidden">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-foreground">
          Análise detalhada
        </summary>
        <div className="border-t border-border/60 px-5 pb-5 pt-4">
          <DetailedAnalysisSummary
            report={detailedAnalysis}
            note={analysisNote}
            onNoteChange={setAnalysisNote}
          />
        </div>
      </motion.details>

      <p className="text-center text-xs text-muted-foreground">
        Dados atualizados em {lastUpdated}
      </p>

      <ExportModal open={showExportModal} onOpenChange={setShowExportModal} />
    </motion.div>
  );
}
