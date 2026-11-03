import type { Absence, AbsenceType } from "@/types/absence";
import type { DateRange } from "@/lib/dateRangeFilter";
import { countAbsenceDays } from "@/lib/absenceStorage";
import { absenceChartColors } from "@/lib/chartTheme";

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  vacation: "Férias",
  sick: "Licença Médica",
  personal: "Motivo Pessoal",
};

export const ABSENCE_TYPE_COLORS: Record<AbsenceType, string> = absenceChartColors;

function overlapsRange(absence: Absence, range: DateRange): boolean {
  return absence.startDate <= range.end && absence.endDate >= range.start;
}

function overlapDays(absence: Absence, range: DateRange): number {
  const overlapStart =
    absence.startDate > range.start ? absence.startDate : range.start;
  const overlapEnd = absence.endDate < range.end ? absence.endDate : range.end;
  if (overlapStart > overlapEnd) return 0;
  return countAbsenceDays(overlapStart, overlapEnd);
}

export function filterAbsencesByRange(
  absences: Absence[],
  range: DateRange,
  options?: { includeRejected?: boolean }
): Absence[] {
  const includeRejected = options?.includeRejected ?? false;
  return absences.filter(
    (absence) =>
      (includeRejected || absence.status !== "rejected") &&
      overlapsRange(absence, range)
  );
}

export interface AbsenceRankingEntry {
  attendantId: number;
  name: string;
  totalDays: number;
  lastDate: string;
  primaryType: AbsenceType;
  typeLabel: string;
}

export function buildAbsenceRanking(
  absences: Absence[],
  range: DateRange
): AbsenceRankingEntry[] {
  const periodAbsences = filterAbsencesByRange(absences, range);
  const byAttendant = new Map<number, { days: number; types: AbsenceType[]; lastEnd: string; name: string }>();

  for (const absence of periodAbsences) {
    const days = overlapDays(absence, range);
    if (days <= 0) continue;

    const current = byAttendant.get(absence.attendantId) ?? {
      days: 0,
      types: [],
      lastEnd: absence.endDate,
      name: absence.attendantName,
    };

    current.days += days;
    current.types.push(absence.type);
    if (absence.endDate > current.lastEnd) {
      current.lastEnd = absence.endDate;
    }
    byAttendant.set(absence.attendantId, current);
  }

  return Array.from(byAttendant.entries())
    .map(([attendantId, data]) => {
      const typeCounts = data.types.reduce(
        (acc, type) => {
          acc[type] = (acc[type] ?? 0) + 1;
          return acc;
        },
        {} as Record<AbsenceType, number>
      );
      const primaryType = (Object.entries(typeCounts).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0] ?? "personal") as AbsenceType;

      return {
        attendantId,
        name: data.name,
        totalDays: data.days,
        lastDate: data.lastEnd,
        primaryType,
        typeLabel: ABSENCE_TYPE_LABELS[primaryType],
      };
    })
    .sort((a, b) => b.totalDays - a.totalDays);
}

export interface AbsenceDistributionEntry {
  name: string;
  value: number;
  color: string;
  type: AbsenceType;
}

export function buildAbsenceDistribution(
  absences: Absence[],
  range: DateRange
): AbsenceDistributionEntry[] {
  const periodAbsences = filterAbsencesByRange(absences, range);
  const dayCounts: Record<AbsenceType, number> = {
    vacation: 0,
    sick: 0,
    personal: 0,
  };

  for (const absence of periodAbsences) {
    dayCounts[absence.type] += overlapDays(absence, range);
  }

  return (Object.keys(dayCounts) as AbsenceType[])
    .filter((type) => dayCounts[type] > 0)
    .map((type) => ({
      type,
      name: ABSENCE_TYPE_LABELS[type],
      value: dayCounts[type],
      color: ABSENCE_TYPE_COLORS[type],
    }));
}

export function getAbsencesForDate(absences: Absence[], dateStr: string): Absence[] {
  return absences.filter(
    (absence) =>
      absence.status !== "rejected" &&
      dateStr >= absence.startDate &&
      dateStr <= absence.endDate
  );
}

export function countAbsencesInMonth(absences: Absence[], monthStr: string): number {
  const [year, month] = monthStr.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const monthPadded = String(month).padStart(2, "0");
  const range: DateRange = {
    start: `${year}-${monthPadded}-01`,
    end: `${year}-${monthPadded}-${String(lastDay).padStart(2, "0")}`,
    label: monthStr,
  };
  return filterAbsencesByRange(absences, range).length;
}

export function totalAbsenceDaysInRange(absences: Absence[], range: DateRange): number {
  return filterAbsencesByRange(absences, range).reduce(
    (sum, absence) => sum + overlapDays(absence, range),
    0
  );
}
