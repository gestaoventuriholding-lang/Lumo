import type { ProductivityRecord } from "@/types/productivity";

export interface ProductivitySummaryRow {
  attendantId: number;
  attendantName: string;
  channel: string;
  inbound: number;
  outbound: number;
  attendances: number;
  tmaSeconds?: number;
  loginSeconds?: number;
  pauseSeconds?: number;
  pausePercent?: number;
  occupancy?: number;
  perHour?: number;
  /** Algum registro cobre um período maior que o filtro (total de relatório mensal, por exemplo) */
  extendsOutsideRange: boolean;
}

export interface ProductivitySummary {
  rows: ProductivitySummaryRow[];
  /** Períodos dos relatórios que ultrapassam o filtro, para avisar na tela */
  widerPeriods: { start: string; end: string }[];
}

function sum(values: (number | undefined)[]): number | undefined {
  const present = values.filter((v): v is number => v != null);
  return present.length > 0 ? present.reduce((a, b) => a + b, 0) : undefined;
}

/**
 * Junta os registros de produtividade que tocam o período escolhido, por colaborador e canal.
 * TMA e ocupação são médias ponderadas (pelos atendimentos e pelo tempo logado).
 */
export function summarizeProductivity(
  records: ProductivityRecord[],
  range: { start: string; end: string },
  knownAttendantIds?: Set<number>
): ProductivitySummary {
  const overlapping = records.filter(
    (r) =>
      r.periodEnd >= range.start &&
      r.periodStart <= range.end &&
      (!knownAttendantIds || knownAttendantIds.has(r.attendantId))
  );

  const groups = new Map<string, ProductivityRecord[]>();
  for (const record of overlapping) {
    const key = `${record.attendantId}|${record.channel}`;
    const list = groups.get(key);
    if (list) list.push(record);
    else groups.set(key, [record]);
  }

  const widerPeriods: { start: string; end: string }[] = [];
  const rows: ProductivitySummaryRow[] = [];

  groups.forEach((list) => {
    const first = list[0];
    const attendances = list.reduce((acc, r) => acc + r.attendancesCount, 0);
    const loginSeconds = sum(list.map((r) => r.loginSeconds));
    const pauseSeconds = sum(list.map((r) => r.pauseSeconds));

    const tmaWeight = list.filter((r) => r.tmaSeconds != null && r.attendancesCount > 0);
    const tmaTotal = tmaWeight.reduce((acc, r) => acc + (r.tmaSeconds ?? 0) * r.attendancesCount, 0);
    const tmaBase = tmaWeight.reduce((acc, r) => acc + r.attendancesCount, 0);

    const occWeight = list.filter((r) => r.occupancyTo1 != null && (r.loginSeconds ?? 0) > 0);
    const occTotal = occWeight.reduce((acc, r) => acc + (r.occupancyTo1 ?? 0) * (r.loginSeconds ?? 0), 0);
    const occBase = occWeight.reduce((acc, r) => acc + (r.loginSeconds ?? 0), 0);

    const extendsOutsideRange = list.some(
      (r) => r.periodStart < range.start || r.periodEnd > range.end
    );
    if (extendsOutsideRange) {
      list.forEach((r) => {
        if (
          (r.periodStart < range.start || r.periodEnd > range.end) &&
          !widerPeriods.some((p) => p.start === r.periodStart && p.end === r.periodEnd)
        ) {
          widerPeriods.push({ start: r.periodStart, end: r.periodEnd });
        }
      });
    }

    rows.push({
      attendantId: first.attendantId,
      attendantName: first.attendantName,
      channel: first.channel,
      inbound: list.reduce((acc, r) => acc + (r.inboundCount ?? 0), 0),
      outbound: list.reduce((acc, r) => acc + (r.outboundCount ?? 0), 0),
      attendances,
      tmaSeconds: tmaBase > 0 ? Math.round(tmaTotal / tmaBase) : undefined,
      loginSeconds,
      pauseSeconds,
      pausePercent:
        loginSeconds && loginSeconds > 0 && pauseSeconds != null
          ? Math.round((pauseSeconds / loginSeconds) * 1000) / 10
          : undefined,
      occupancy: occBase > 0 ? Math.round((occTotal / occBase) * 100) / 100 : undefined,
      perHour:
        loginSeconds && loginSeconds > 0
          ? Math.round((attendances / (loginSeconds / 3600)) * 100) / 100
          : undefined,
      extendsOutsideRange,
    });
  });

  rows.sort((a, b) => b.attendances - a.attendances || a.attendantName.localeCompare(b.attendantName, "pt-BR"));
  return { rows, widerPeriods };
}
