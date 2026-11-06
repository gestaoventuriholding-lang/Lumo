import type { Attendant, AttendantRecordChannel } from "@/types/attendant";
import { attendsChannel } from "@/lib/attendantStatus";

export interface TimeSlot {
  minutes: number;
  label: string;
}

export interface OccupancyRow {
  attendantId: number;
  name: string;
  workingHours: string;
  jornadaStart: string;
  jornadaEnd: string;
  hasSchedule: boolean;
  activeSlots: boolean[];
}

export interface OccupancyMapData {
  channel: AttendantRecordChannel;
  channelLabel: string;
  slots: TimeSlot[];
  counts: number[];
  rows: OccupancyRow[];
  peakCount: number;
  peakSlotIndices: number[];
  gapSlotIndices: number[];
  scheduledAttendants: number;
}

const DEFAULT_START_MINUTES = 6 * 60;
const DEFAULT_END_MINUTES = 20 * 60;
const SLOT_MINUTES = 30;

export function parseTimeToMinutes(time: string): number | null {
  if (!time?.includes(":")) return null;
  const [hourPart, minutePart] = time.split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

export function formatSlotLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${String(hours).padStart(2, "0")}h`;
  }
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function isActiveInSlot(startMin: number, endMin: number, slotMin: number): boolean {
  return startMin <= slotMin && endMin > slotMin;
}

export function buildOccupancyMap(
  attendants: Attendant[],
  channel: AttendantRecordChannel
): OccupancyMapData {
  const channelAttendants = attendants
    .filter((attendant) => attendsChannel(attendant, channel))
    .sort((a, b) => {
      const aStart = parseTimeToMinutes(a.jornadaStart) ?? 9999;
      const bStart = parseTimeToMinutes(b.jornadaStart) ?? 9999;
      if (aStart !== bStart) return aStart - bStart;
      return a.name.localeCompare(b.name, "pt-BR");
    });

  const scheduled = channelAttendants.filter((attendant) => {
    const start = parseTimeToMinutes(attendant.jornadaStart);
    const end = parseTimeToMinutes(attendant.jornadaEnd);
    return start != null && end != null && start < end;
  });

  let rangeStart = DEFAULT_START_MINUTES;
  let rangeEnd = DEFAULT_END_MINUTES;

  if (scheduled.length > 0) {
    const starts = scheduled.map((attendant) => parseTimeToMinutes(attendant.jornadaStart)!);
    const ends = scheduled.map((attendant) => parseTimeToMinutes(attendant.jornadaEnd)!);
    rangeStart =
      Math.floor(Math.min(...starts) / SLOT_MINUTES) * SLOT_MINUTES - SLOT_MINUTES;
    rangeEnd = Math.ceil(Math.max(...ends) / SLOT_MINUTES) * SLOT_MINUTES + SLOT_MINUTES;
    rangeStart = Math.max(0, rangeStart);
    rangeEnd = Math.min(24 * 60, Math.max(rangeEnd, rangeStart + SLOT_MINUTES));
  }

  const slots: TimeSlot[] = [];
  for (let minutes = rangeStart; minutes < rangeEnd; minutes += SLOT_MINUTES) {
    slots.push({ minutes, label: formatSlotLabel(minutes) });
  }

  const rows: OccupancyRow[] = channelAttendants.map((attendant) => {
    const startMin = parseTimeToMinutes(attendant.jornadaStart);
    const endMin = parseTimeToMinutes(attendant.jornadaEnd);
    const hasSchedule =
      startMin != null && endMin != null && startMin < endMin;

    const activeSlots = slots.map((slot) =>
      hasSchedule ? isActiveInSlot(startMin!, endMin!, slot.minutes) : false
    );

    return {
      attendantId: attendant.id,
      name: attendant.name,
      workingHours: attendant.workingHours,
      jornadaStart: attendant.jornadaStart,
      jornadaEnd: attendant.jornadaEnd,
      hasSchedule,
      activeSlots,
    };
  });

  const counts = slots.map((_slot, slotIndex) =>
    rows.reduce((sum, row) => sum + (row.activeSlots[slotIndex] ? 1 : 0), 0)
  );

  const peakCount = counts.length > 0 ? Math.max(...counts) : 0;
  const peakSlotIndices = counts
    .map((count, index) => (count === peakCount && peakCount > 0 ? index : -1))
    .filter((index) => index >= 0);
  const gapSlotIndices = counts
    .map((count, index) => (count === 0 ? index : -1))
    .filter((index) => index >= 0);

  return {
    channel,
    channelLabel: channel === "Ligação" ? "Ligação (Telefonia)" : "WhatsApp (Chat)",
    slots,
    counts,
    rows,
    peakCount,
    peakSlotIndices,
    gapSlotIndices,
    scheduledAttendants: scheduled.length,
  };
}
