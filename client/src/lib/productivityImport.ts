import { newId } from "@/lib/ids";
import { createAttendant, toAttendantServiceChannel } from "@/lib/attendantsStorage";
import { normalizeText, type ProductivityReport } from "@/lib/reportParser";
import type { Attendant } from "@/types/attendant";
import type { AttendanceChannel } from "@/types/goals";
import type { DailyPerformanceRecord } from "@/types/performance";
import type { ProductivityRecord } from "@/types/productivity";

export interface ProductivityImportOptions {
  channel: AttendanceChannel;
  /** Obrigatórios quando o relatório é total do período */
  periodStart?: string;
  periodEnd?: string;
  createAttendants: boolean;
  fileName?: string;
}

export interface ProductivityImportResult {
  attendants: Attendant[];
  performanceRecords: DailyPerformanceRecord[];
  productivityRecords: ProductivityRecord[];
  summary: {
    productivityCreated: number;
    productivityUpdated: number;
    dailyImported: number;
    dailyUpdated: number;
    createdAttendants: number;
    unmatchedNames: string[];
    attendantsInFile: number;
    days: string[];
  };
  logMessage: string;
}

export interface ProductivityImportPreview {
  matched: string[];
  toCreate: string[];
  /** Colaboradores do arquivo que já têm registro para este período/canal */
  alreadyImported: string[];
}

function byName(attendants: Attendant[]) {
  return new Map(attendants.map((a) => [normalizeText(a.name), a]));
}

export function previewProductivityImport(
  report: ProductivityReport,
  attendants: Attendant[],
  existing: ProductivityRecord[],
  options: Pick<ProductivityImportOptions, "channel" | "periodStart" | "periodEnd">
): ProductivityImportPreview {
  const known = byName(attendants);
  const matched: string[] = [];
  const toCreate: string[] = [];
  const alreadyImported: string[] = [];

  for (const row of report.rows) {
    const attendant = known.get(normalizeText(row.attendantName));
    if (attendant) {
      matched.push(row.attendantName);
      const start = row.date ?? options.periodStart;
      const end = row.date ?? options.periodEnd;
      if (
        existing.some(
          (r) =>
            r.attendantId === attendant.id &&
            r.periodStart === start &&
            r.periodEnd === end &&
            r.channel === options.channel
        )
      ) {
        alreadyImported.push(row.attendantName);
      }
    } else {
      toCreate.push(row.attendantName);
    }
  }
  return { matched, toCreate, alreadyImported };
}

function formatBrDate(iso: string): string {
  return iso.split("-").reverse().join("/");
}

export function executeProductivityImport(
  report: ProductivityReport,
  attendants: Attendant[],
  performance: DailyPerformanceRecord[],
  productivity: ProductivityRecord[],
  options: ProductivityImportOptions
): ProductivityImportResult {
  const nextAttendants = [...attendants];
  const nextPerformance = [...performance];
  const nextProductivity = [...productivity];
  const known = byName(nextAttendants);
  const now = new Date().toISOString();

  let productivityCreated = 0;
  let productivityUpdated = 0;
  let dailyImported = 0;
  let dailyUpdated = 0;
  let createdAttendants = 0;
  const unmatchedNames: string[] = [];
  const days = new Set<string>();
  const touched = new Set<number>();

  for (const row of report.rows) {
    let attendant = known.get(normalizeText(row.attendantName));
    if (!attendant && options.createAttendants) {
      attendant = createAttendant(
        {
          name: row.attendantName.trim(),
          role: "Atendente",
          serviceChannel: toAttendantServiceChannel(options.channel) ?? "Ligação",
          workingHours: "",
          jornadaStart: "",
          jornadaEnd: "",
          observation: "Importado automaticamente",
        },
        nextAttendants
      );
      nextAttendants.push(attendant);
      known.set(normalizeText(attendant.name), attendant);
      createdAttendants++;
    }
    if (!attendant) {
      unmatchedNames.push(row.attendantName);
      continue;
    }
    touched.add(attendant.id);

    const start = row.date ?? options.periodStart;
    const end = row.date ?? options.periodEnd;
    if (!start || !end) continue;

    const metrics = {
      inboundCount: row.inbound,
      outboundCount: row.outbound,
      attendancesCount: row.total,
      talkSeconds: row.talkSeconds,
      tmaSeconds: row.tmaSeconds,
      loginSeconds: row.loginSeconds,
      pauseSeconds: row.pauseSeconds,
      pausePercent: row.pausePercent,
      pauseLegalSeconds: row.pauseLegalSeconds,
      pauseProductiveSeconds: row.pauseProductiveSeconds,
      pauseUnproductiveSeconds: row.pauseUnproductiveSeconds,
      occupancyTo1: row.occupancy1,
      occupancyTo2: row.occupancy2,
      occupancyTo3: row.occupancy3,
      occupancyTo4: row.occupancy4,
      perHour: row.perHour,
      reportCode: report.reportCode,
      sourceFile: options.fileName,
    };

    const index = nextProductivity.findIndex(
      (r) =>
        r.attendantId === attendant!.id &&
        r.periodStart === start &&
        r.periodEnd === end &&
        r.channel === options.channel
    );
    if (index >= 0) {
      nextProductivity[index] = {
        ...nextProductivity[index],
        ...metrics,
        attendantName: attendant.name,
        updatedAt: now,
      };
      productivityUpdated++;
    } else {
      nextProductivity.push({
        id: newId(),
        attendantId: attendant.id,
        attendantName: attendant.name,
        periodStart: start,
        periodEnd: end,
        channel: options.channel,
        ...metrics,
        createdAt: now,
        updatedAt: now,
      });
      productivityCreated++;
    }

    // Relatório por dia também alimenta o desempenho diário (gráficos e rankings)
    if (row.date) {
      days.add(row.date);
      const averageTimeMinutes =
        row.tmaSeconds != null ? Math.round((row.tmaSeconds / 60) * 100) / 100 : 0;
      const dayIndex = nextPerformance.findIndex(
        (r) =>
          r.attendantId === attendant!.id && r.date === row.date && r.channel === options.channel
      );
      if (dayIndex >= 0) {
        nextPerformance[dayIndex] = {
          ...nextPerformance[dayIndex],
          attendancesCount: row.total,
          averageTimeMinutes,
          attendantName: attendant.name,
          updatedAt: now,
        };
        dailyUpdated++;
      } else {
        nextPerformance.push({
          id: newId(),
          attendantId: attendant.id,
          attendantName: attendant.name,
          date: row.date,
          channel: options.channel,
          attendancesCount: row.total,
          averageTimeMinutes,
          createdAt: now,
          updatedAt: now,
        });
        dailyImported++;
      }
    }
  }

  const records = productivityCreated + productivityUpdated;
  const where =
    report.mode === "period" && options.periodStart && options.periodEnd
      ? ` do período ${formatBrDate(options.periodStart)} a ${formatBrDate(options.periodEnd)}`
      : "";
  const people = `${touched.size} colaborador${touched.size === 1 ? "" : "es"}`;
  const created =
    createdAttendants > 0
      ? `, ${createdAttendants} novo${createdAttendants === 1 ? "" : "s"} cadastrado${createdAttendants === 1 ? "" : "s"}`
      : "";
  const logMessage =
    records > 0
      ? `Relatório ${report.reportCode ?? "de produtividade"}${where}: ${records} registro${records === 1 ? "" : "s"} de ${people}${created}`
      : "Nenhum registro importado";

  return {
    attendants: nextAttendants,
    performanceRecords: nextPerformance,
    productivityRecords: nextProductivity,
    summary: {
      productivityCreated,
      productivityUpdated,
      dailyImported,
      dailyUpdated,
      createdAttendants,
      unmatchedNames,
      attendantsInFile: report.rows.length,
      days: Array.from(days).sort(),
    },
    logMessage,
  };
}
