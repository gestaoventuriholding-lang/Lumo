import type { DailyPerformanceRecord } from "@/types/performance";
import type { ProductivityRecord } from "@/types/productivity";
import type { AttendanceChannel } from "@/types/goals";

function parseIso(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Dias úteis (seg–sex) entre duas datas, inclusive; mínimo 1 */
export function countWeekdays(start: string, end: string): number {
  const last = parseIso(end);
  let count = 0;
  for (const day = parseIso(start); day <= last; day.setDate(day.getDate() + 1)) {
    const weekday = day.getDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return Math.max(1, count);
}

/**
 * Junta os totais de período (relatório sem dia a dia) aos registros diários, para
 * Dashboard e Desempenho baterem com o relatório. O total só entra quando o período
 * do relatório cabe inteiro no filtro, e nunca duplica quem já tem registros diários.
 * Os registros criados aqui não são gravados (id negativo, `periodDays` preenchido).
 */
export function mergePeriodTotals(
  records: DailyPerformanceRecord[],
  productivity: ProductivityRecord[],
  range: { start: string; end: string }
): DailyPerformanceRecord[] {
  const totals = productivity.filter(
    (p) =>
      p.periodEnd > p.periodStart &&
      p.periodStart >= range.start &&
      p.periodEnd <= range.end &&
      p.attendancesCount > 0
  );
  if (totals.length === 0) return records;

  const synthetic: DailyPerformanceRecord[] = [];
  totals.forEach((p) => {
    const alreadyDaily = records.some(
      (r) =>
        r.attendantId === p.attendantId &&
        r.channel === (p.channel as AttendanceChannel) &&
        r.date >= p.periodStart &&
        r.date <= p.periodEnd
    );
    if (alreadyDaily) return;
    synthetic.push({
      id: -p.id,
      attendantId: p.attendantId,
      attendantName: p.attendantName,
      date: p.periodEnd,
      channel: p.channel as AttendanceChannel,
      attendancesCount: p.attendancesCount,
      averageTimeMinutes: p.tmaSeconds != null ? Math.round((p.tmaSeconds / 60) * 100) / 100 : 0,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      periodDays: countWeekdays(p.periodStart, p.periodEnd),
    });
  });
  return synthetic.length > 0 ? [...records, ...synthetic] : records;
}
