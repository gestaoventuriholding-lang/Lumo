import { useMemo, useState } from "react";
import { ChevronDown, MessageCircle, Phone, Trophy } from "lucide-react";
import {
  compareAttendantSummaries,
  goalPercentageTone,
  RANKING_CRITERIA,
  type AttendantPerformanceSummary,
  type RankingCriterion,
} from "@/lib/performanceMetrics";
import { formatAverageTime } from "@/lib/performanceStorage";
import { periodScopeLabel, type DashboardPeriod } from "@/lib/dateRangeFilter";
import { cn } from "@/lib/utils";

type RankingChannel = "WhatsApp" | "Ligação";

type PerformanceRankingsProps = {
  ligacaoSummaries: AttendantPerformanceSummary[];
  whatsappSummaries: AttendantPerformanceSummary[];
  overallSummaries?: AttendantPerformanceSummary[];
  period: DashboardPeriod;
};

const TOP_COUNT = 3;

const STORAGE_KEY = "lumo-ranking-prefs";

function loadPrefs(): { channel?: RankingChannel; criterion?: RankingCriterion } {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function savePrefs(prefs: { channel: RankingChannel; criterion: RankingCriterion }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* sem armazenamento: só não lembra a escolha */
  }
}

const positionStyles = [
  "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  "bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-100",
  "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300",
  "bg-muted text-muted-foreground",
];

function PositionBadge({ position }: { position: number }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
        positionStyles[Math.min(position - 1, 3)]
      )}
    >
      {position}
    </span>
  );
}

const toneText = {
  green: "text-emerald-600 dark:text-emerald-400",
  yellow: "text-amber-600 dark:text-amber-400",
  red: "text-red-600 dark:text-red-400",
  muted: "text-muted-foreground",
} as const;

/** Barra de meta: o traço marca 100%; quem passa da meta ganha um trecho extra */
function GoalBar({ value, scale }: { value: number; scale: number }) {
  const rounded = Math.round(value);
  const tone = goalPercentageTone(value);
  const goalAt = (100 / scale) * 100;
  const filled = Math.min(100, (Math.min(value, 100) / scale) * 100);
  const extra = value > 100 ? ((value - 100) / scale) * 100 : 0;
  const color = value >= 100 ? "bg-emerald-500" : value >= 85 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex min-w-[150px] items-center gap-2.5">
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("absolute inset-y-0 left-0 rounded-full", color)} style={{ width: `${filled}%` }} />
        {extra > 0 && (
          <div
            className="absolute inset-y-0 rounded-r-full bg-gradient-to-r from-emerald-400 to-cyan-300"
            style={{ left: `${goalAt}%`, width: `${extra}%` }}
          />
        )}
        <span className="absolute inset-y-0 w-px bg-foreground/50" style={{ left: `${goalAt}%` }} />
      </div>
      <span className={cn("w-12 text-right text-sm font-bold tabular-nums", toneText[tone])}>
        {value > 0 ? `${rounded}%` : "—"}
      </span>
    </div>
  );
}

function RankingTable({
  summaries,
  criterion,
  expanded,
  onToggle,
}: {
  summaries: AttendantPerformanceSummary[];
  criterion: RankingCriterion;
  expanded: boolean;
  onToggle: () => void;
}) {
  const ranked = useMemo(
    () =>
      summaries
        .filter((summary) => summary.totalAttendances > 0)
        .sort((a, b) => compareAttendantSummaries(a, b, criterion)),
    [summaries, criterion]
  );
  const rows = expanded ? ranked : ranked.slice(0, TOP_COUNT);
  const scale = Math.max(100, ...rows.map((row) => row.averagePercentage));

  const highlight = (key: RankingCriterion) =>
    criterion === key ? "font-semibold text-foreground" : "text-muted-foreground";

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-border/60 text-xs text-muted-foreground">
            <th className="pb-3 pr-3 text-left font-medium">Colaborador</th>
            <th className="pb-3 pr-3 text-center font-medium">Atendimentos</th>
            <th className="pb-3 pr-3 text-center font-medium">TMA</th>
            <th className="pb-3 text-left font-medium">Meta (100% = bateu a meta)</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((summary, index) => (
              <tr key={summary.attendantId} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-2.5">
                    <PositionBadge position={index + 1} />
                    <span className="font-medium text-foreground">{summary.name}</span>
                  </div>
                </td>
                <td className={cn("py-3 pr-3 text-center tabular-nums", highlight("attendances"))}>
                  {summary.totalAttendances.toLocaleString("pt-BR")}
                </td>
                <td className={cn("py-3 pr-3 text-center tabular-nums", highlight("tma"))}>
                  {summary.averageTimeMinutes > 0 ? formatAverageTime(summary.averageTimeMinutes) : "—"}
                </td>
                <td className="py-3">
                  <GoalBar value={summary.averagePercentage} scale={scale} />
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className="py-8 text-center text-muted-foreground">
                Nenhum atendimento neste canal no período.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {ranked.length > TOP_COUNT && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-blue-600 transition-colors hover:bg-muted/50 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {expanded ? `Mostrar só o top ${TOP_COUNT}` : `Ver todos (${ranked.length})`}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
        </button>
      )}
    </div>
  );
}

export default function PerformanceRankings({
  ligacaoSummaries,
  whatsappSummaries,
}: PerformanceRankingsProps) {
  const total = (list: AttendantPerformanceSummary[]) =>
    list.reduce((sum, item) => sum + item.totalAttendances, 0);

  const [channel, setChannel] = useState<RankingChannel>(() => {
    const saved = loadPrefs().channel;
    if (saved === "WhatsApp" || saved === "Ligação") return saved;
    return total(whatsappSummaries) >= total(ligacaoSummaries) ? "WhatsApp" : "Ligação";
  });
  const [criterion, setCriterion] = useState<RankingCriterion>(() => {
    const saved = loadPrefs().criterion;
    return RANKING_CRITERIA.some((c) => c.value === saved) ? (saved as RankingCriterion) : "goal";
  });

  function update(next: Partial<{ channel: RankingChannel; criterion: RankingCriterion }>) {
    const merged = { channel, criterion, ...next };
    setChannel(merged.channel);
    setCriterion(merged.criterion);
    savePrefs(merged);
  }

  const summaries = channel === "WhatsApp" ? whatsappSummaries : ligacaoSummaries;
  const active = RANKING_CRITERIA.find((c) => c.value === criterion);
  const [expanded, setExpanded] = useState(false);

  const channels: { value: RankingChannel; icon: typeof Phone }[] = [
    { value: "WhatsApp", icon: MessageCircle },
    { value: "Ligação", icon: Phone },
  ];

  return (
    <div className="lumo-panel-sm p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
          <Trophy className="h-4 w-4 text-amber-500" />
          Ranking
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Canal do ranking" className="flex rounded-xl bg-muted/60 p-1">
            {channels.map(({ value, icon: Icon }) => (
              <button
                key={value}
                role="tab"
                aria-selected={channel === value}
                onClick={() => update({ channel: value })}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  channel === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {value}
              </button>
            ))}
          </div>
          <div role="tablist" aria-label="Ordenar ranking por" className="flex rounded-xl bg-muted/60 p-1">
            {RANKING_CRITERIA.map((item) => (
              <button
                key={item.value}
                role="tab"
                aria-selected={criterion === item.value}
                onClick={() => update({ criterion: item.value })}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  criterion === item.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">Ordenado por {active?.label.toLowerCase()}. {active?.hint}</p>

      <RankingTable summaries={summaries} criterion={criterion}
        expanded={expanded}
        onToggle={() => setExpanded((value) => !value)}
      />
    </div>
  );
}

export { periodScopeLabel };
