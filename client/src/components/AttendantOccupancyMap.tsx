import { useMemo, useState, type MouseEvent } from "react";
import { AlertTriangle, Clock, MessageCircle, Phone, TrendingUp, Users } from "lucide-react";
import type { Attendant } from "@/types/attendant";
import { motion } from "@/lib/motionVariants";
import {
  buildOccupancyMap,
  formatSlotLabel,
  parseTimeToMinutes,
  type OccupancyMapData,
  type OccupancyRow,
} from "@/lib/occupancyMap";
import { cn } from "@/lib/utils";

interface AttendantOccupancyMapProps {
  attendants: Attendant[];
}

const SLOT_MINUTES = 30;
const SLOT_MIN_WIDTH = 30;
const NAME_COLUMN = "w-[210px] shrink-0";

const CHANNEL_STYLE = {
  Ligação: {
    icon: Phone,
    rgb: "51 102 255",
    chip: "bg-[#3366FF]/12 text-[#3366FF] dark:bg-[#7BA7FF]/15 dark:text-[#7BA7FF]",
    bar: "from-[#3366FF] to-[#7BA7FF]",
  },
  WhatsApp: {
    icon: MessageCircle,
    rgb: "16 185 129",
    chip: "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
    bar: "from-emerald-500 to-teal-300",
  },
} as const;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function formatHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

function slotRangeLabel(minutes: number) {
  const end = minutes + SLOT_MINUTES;
  const fmt = (v: number) =>
    `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
  return `${fmt(minutes)}–${fmt(end)}`;
}

function nowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Users;
  label: string;
  value: string;
  tone?: "default" | "warn";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3 py-2",
        tone === "warn"
          ? "border-amber-400/40 bg-amber-400/10"
          : "border-border/60 bg-muted/30"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          tone === "warn" ? "text-amber-600 dark:text-amber-300" : "text-muted-foreground"
        )}
      />
      <div className="leading-tight">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function OccupancySection({ data }: { data: OccupancyMapData }) {
  const style = CHANNEL_STYLE[data.channel];
  const Icon = style.icon;
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);

  const slotCount = data.slots.length;
  const rangeStart = data.slots[0]?.minutes ?? 0;
  const rangeEnd = rangeStart + slotCount * SLOT_MINUTES;
  const total = Math.max(1, rangeEnd - rangeStart);
  const pct = (minutes: number) => ((minutes - rangeStart) / total) * 100;
  const timelineMinWidth = slotCount * SLOT_MIN_WIDTH;

  const hourMarks = useMemo(
    () => data.slots.filter((slot) => slot.minutes % 60 === 0),
    [data.slots]
  );

  const now = nowMinutes();
  const showNow = now >= rangeStart && now <= rangeEnd;

  const activeNames = (index: number) =>
    data.rows.filter((row) => row.activeSlots[index]).map((row) => row.name);

  function handleMove(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const index = Math.floor(((event.clientX - rect.left) / rect.width) * slotCount);
    setHoverSlot(Math.min(slotCount - 1, Math.max(0, index)));
  }

  if (data.rows.length === 0) {
    return (
      <section className="lumo-panel-sm overflow-hidden p-5">
        <div className="flex items-center gap-3">
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", style.chip)}>
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-foreground">{data.channelLabel}</h3>
            <p className="text-sm text-muted-foreground">Nenhum colaborador cadastrado neste canal.</p>
          </div>
        </div>
      </section>
    );
  }

  const hoverNames = hoverSlot != null ? activeNames(hoverSlot) : [];
  // lacuna de verdade = faixa vazia entre a primeira e a última pessoa escalada (as pontas são só margem do mapa)
  const firstCovered = data.counts.findIndex((count) => count > 0);
  const lastCovered = data.counts.reduce((last, count, index) => (count > 0 ? index : last), -1);
  const isInnerGap = (index: number) => index > firstCovered && index < lastCovered && data.counts[index] === 0;
  const innerGaps = data.counts.filter((_count, index) => isInnerGap(index)).length;
  const gapMinutes = innerGaps * SLOT_MINUTES;
  const coverageLabel =
    firstCovered >= 0
      ? `${formatSlotLabel(data.slots[firstCovered].minutes)} às ${formatSlotLabel(data.slots[lastCovered].minutes + SLOT_MINUTES)}`
      : "sem jornadas definidas";

  return (
    <section className="lumo-panel-sm overflow-hidden">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", style.chip)}>
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold leading-tight text-foreground">{data.channelLabel}</h3>
              <p className="text-xs text-muted-foreground">Escala de {coverageLabel}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Stat
              icon={Users}
              label="Com jornada definida"
              value={`${data.scheduledAttendants} de ${data.rows.length}`}
            />
            <Stat
              icon={TrendingUp}
              label="Pico simultâneo"
              value={`${data.peakCount} atendente${data.peakCount === 1 ? "" : "s"}`}
            />
            <Stat
              icon={innerGaps > 0 ? AlertTriangle : Clock}
              label="Sem ninguém escalado"
              value={innerGaps > 0 ? formatHours(gapMinutes) : "Cobertura total"}
              tone={innerGaps > 0 ? "warn" : "default"}
            />
          </div>
        </div>

        <div className="overflow-x-auto pb-1">
          <div style={{ minWidth: `calc(210px + ${timelineMinWidth}px)` }}>
            {/* Escala de horas */}
            <div className="flex items-end">
              <div className={NAME_COLUMN} />
              <div className="relative h-6 flex-1">
                {hourMarks.map((slot) => (
                  <span
                    key={slot.minutes}
                    className="absolute bottom-0 -translate-x-1/2 text-[11px] font-medium text-muted-foreground"
                    style={{ left: `${pct(slot.minutes)}%` }}
                  >
                    {formatSlotLabel(slot.minutes)}
                  </span>
                ))}
              </div>
            </div>

            {/* Quantos atendentes por faixa */}
            <div className="mt-1 flex items-center">
              <div className={cn(NAME_COLUMN, "pr-3")}>
                <p className="text-xs font-semibold text-foreground">Pessoas escaladas</p>
                <p className="text-[11px] text-muted-foreground">por faixa de 30 min</p>
              </div>
              <div
                className="relative flex h-10 flex-1 gap-px"
                onMouseMove={handleMove}
                onMouseLeave={() => setHoverSlot(null)}
              >
                {data.counts.map((count, index) => {
                  const isGap = isInnerGap(index);
                  const isEdge = count === 0 && !isGap;
                  const isPeak = count === data.peakCount && count > 0;
                  const intensity = data.peakCount > 0 ? count / data.peakCount : 0;
                  return (
                    <div
                      key={data.slots[index].minutes}
                      className={cn(
                        "flex flex-1 items-center justify-center rounded-md text-xs font-bold transition-transform",
                        isGap
                          ? "bg-amber-400/25 text-amber-700 dark:text-amber-300"
                          : isEdge
                            ? "bg-muted/30 text-muted-foreground/50"
                            : "text-foreground",
                        hoverSlot === index && "scale-y-110 ring-1 ring-foreground/30",
                        isPeak && "ring-1 ring-inset ring-foreground/20"
                      )}
                      style={
                        isGap || isEdge
                          ? undefined
                          : { backgroundColor: `rgb(${style.rgb} / ${0.14 + intensity * 0.5})` }
                      }
                    >
                      {count}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Linha explicativa ao passar o mouse */}
            <div className="mb-2 mt-2 flex min-h-[22px] items-center">
              <div className={NAME_COLUMN} />
              <p className="text-xs text-muted-foreground">
                {hoverSlot == null ? (
                  "Passe o mouse sobre os horários para ver quem está escalado."
                ) : hoverNames.length === 0 ? (
                  <span className="font-medium text-amber-700 dark:text-amber-300">
                    {slotRangeLabel(data.slots[hoverSlot].minutes)} · ninguém escalado
                  </span>
                ) : (
                  <>
                    <span className="font-semibold text-foreground">
                      {slotRangeLabel(data.slots[hoverSlot].minutes)}
                    </span>
                    {" · "}
                    {hoverNames.length} {hoverNames.length === 1 ? "pessoa" : "pessoas"}: {hoverNames.join(", ")}
                  </>
                )}
              </p>
            </div>

            {/* Uma linha por colaborador */}
            <div className="divide-y divide-border/40 rounded-xl border border-border/50 bg-background/30">
              {data.rows.map((row, rowIndex) => (
                <OccupancyRowView
                  key={row.attendantId}
                  row={row}
                  index={rowIndex}
                  style={style}
                  rangeStart={rangeStart}
                  total={total}
                  slotCount={slotCount}
                  hourMarks={hourMarks.map((slot) => pct(slot.minutes))}
                  hoverSlot={hoverSlot}
                  showNow={showNow}
                  nowPct={pct(now)}
                  onMove={handleMove}
                  onLeave={() => setHoverSlot(null)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-6 rounded-full bg-gradient-to-r", style.bar)} /> Horário de trabalho
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-400/40" /> Faixa sem ninguém escalado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 rounded bg-rose-500" /> Agora
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-muted-foreground/50" /> Jornada
            não informada
          </span>
        </div>
      </div>
    </section>
  );
}

function OccupancyRowView({
  row,
  index,
  style,
  rangeStart,
  total,
  slotCount,
  hourMarks,
  hoverSlot,
  showNow,
  nowPct,
  onMove,
  onLeave,
}: {
  row: OccupancyRow;
  index: number;
  style: (typeof CHANNEL_STYLE)[keyof typeof CHANNEL_STYLE];
  rangeStart: number;
  total: number;
  slotCount: number;
  hourMarks: number[];
  hoverSlot: number | null;
  showNow: boolean;
  nowPct: number;
  onMove: (event: MouseEvent<HTMLDivElement>) => void;
  onLeave: () => void;
}) {
  const start = parseTimeToMinutes(row.jornadaStart);
  const end = parseTimeToMinutes(row.jornadaEnd);
  const left = row.hasSchedule && start != null ? ((start - rangeStart) / total) * 100 : 0;
  const width = row.hasSchedule && start != null && end != null ? ((end - start) / total) * 100 : 0;
  const duration = start != null && end != null && end > start ? end - start : 0;

  return (
    <div className="flex items-center transition-colors hover:bg-muted/30">
      <div className={cn(NAME_COLUMN, "flex items-center gap-2.5 px-3 py-2.5")}>
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
            style.chip
          )}
        >
          {initials(row.name)}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {row.hasSchedule
              ? `${row.jornadaStart.slice(0, 5)}–${row.jornadaEnd.slice(0, 5)} · ${formatHours(duration)}`
              : "Jornada não informada"}
          </p>
        </div>
      </div>

      <div
        className="relative h-12 flex-1"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        {hourMarks.map((mark) => (
          <span
            key={mark}
            className="absolute inset-y-0 w-px bg-border/40"
            style={{ left: `${mark}%` }}
          />
        ))}
        {hoverSlot != null && (
          <span
            className="absolute inset-y-0 bg-foreground/[0.06]"
            style={{ left: `${(hoverSlot / slotCount) * 100}%`, width: `${100 / slotCount}%` }}
          />
        )}
        {row.hasSchedule ? (
          <motion.div
            className={cn(
              "absolute top-1/2 h-6 -translate-y-1/2 origin-left rounded-full bg-gradient-to-r shadow-sm",
              style.bar
            )}
            style={{ left: `${left}%`, width: `${width}%` }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.05 * index, ease: [0.22, 1, 0.36, 1] }}
            title={`${row.name} · ${row.jornadaStart.slice(0, 5)} às ${row.jornadaEnd.slice(0, 5)}`}
          />
        ) : (
          <div className="absolute inset-x-2 top-1/2 h-6 -translate-y-1/2 rounded-full border border-dashed border-muted-foreground/30" />
        )}
        {showNow && (
          <span
            className="absolute inset-y-0 z-10 w-0.5 rounded bg-rose-500/80"
            style={{ left: `${nowPct}%` }}
          />
        )}
      </div>
    </div>
  );
}

export default function AttendantOccupancyMap({ attendants }: AttendantOccupancyMapProps) {
  const ligacaoMap = useMemo(() => buildOccupancyMap(attendants, "Ligação"), [attendants]);
  const whatsappMap = useMemo(() => buildOccupancyMap(attendants, "WhatsApp"), [attendants]);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Mapa de ocupação por horário</h2>
        <p className="text-sm text-muted-foreground">
          Veja quando cada colaborador trabalha e quantas pessoas cobrem cada horário. Faixas em âmbar
          estão sem ninguém. Preencha início e fim da jornada no cadastro para aparecer no mapa.
        </p>
      </div>

      <OccupancySection data={ligacaoMap} />
      <OccupancySection data={whatsappMap} />
    </div>
  );
}
