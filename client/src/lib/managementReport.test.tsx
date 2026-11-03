import { describe, expect, it } from "vitest";
import type { Attendant } from "@/types/attendant";
import type { ProductionGoal } from "@/types/goals";
import type { DailyPerformanceRecord } from "@/types/performance";
import {
  buildManagementReportData,
  hasManagementReportContent,
  managementReportFilename,
} from "./managementReport";

const attendants: Attendant[] = [
  {
    id: 1,
    name: "Ana Silva",
    role: "Atendente",
    serviceChannel: "Ligação" as const,
    workingHours: "08h00",
    jornadaStart: "",
    jornadaEnd: "",
    observation: "",
    registrationDate: "2026-01-01",
  },
  {
    id: 2,
    name: "Bruno Costa",
    role: "Atendente",
    serviceChannel: "Ligação" as const,
    workingHours: "08h00",
    jornadaStart: "",
    jornadaEnd: "",
    observation: "",
    registrationDate: "2026-01-01",
  },
];

const productionGoals: ProductionGoal[] = [
  {
    id: 1,
    channel: "Ligação",
    dailyTarget: 50,
    status: "Ativo",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
  {
    id: 2,
    channel: "WhatsApp",
    dailyTarget: 40,
    status: "Ativo",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
];

describe("buildManagementReportData", () => {
  it("monta rankings por canal e abaixo da meta", () => {
    const records: DailyPerformanceRecord[] = [
      {
        id: 1,
        attendantId: 1,
        attendantName: "Ana Silva",
        date: "2026-06-09",
        channel: "Ligação",
        attendancesCount: 60,
        averageTimeMinutes: 4,
        createdAt: "2026-06-09",
        updatedAt: "2026-06-09",
      },
      {
        id: 2,
        attendantId: 2,
        attendantName: "Bruno Costa",
        date: "2026-06-09",
        channel: "WhatsApp",
        attendancesCount: 20,
        averageTimeMinutes: 5,
        createdAt: "2026-06-09",
        updatedAt: "2026-06-09",
      },
    ];

    const data = buildManagementReportData({
      period: "day",
      dateRange: { start: "2026-06-09", end: "2026-06-09", label: "09/06/2026" },
      attendants,
      performanceRecords: records,
      productionGoals,
      generatedAt: new Date("2026-06-09T15:00:00"),
    });

    expect(data.ligacaoRanking).toHaveLength(1);
    expect(data.ligacaoRanking[0].name).toBe("Ana Silva");
    expect(data.whatsappRanking).toHaveLength(1);
    expect(data.whatsappRanking[0].name).toBe("Bruno Costa");
    expect(data.belowGoal.some((row) => row.name === "Bruno Costa")).toBe(true);
    expect(data.productivityTrend).toHaveLength(1);
    expect(hasManagementReportContent(data)).toBe(true);
  });

  it("filtra por canal e colaboradores", () => {
    const records: DailyPerformanceRecord[] = [
      {
        id: 1,
        attendantId: 1,
        attendantName: "Ana Silva",
        date: "2026-06-09",
        channel: "Ligação",
        attendancesCount: 60,
        averageTimeMinutes: 4,
        createdAt: "2026-06-09",
        updatedAt: "2026-06-09",
      },
      {
        id: 2,
        attendantId: 2,
        attendantName: "Bruno Costa",
        date: "2026-06-09",
        channel: "WhatsApp",
        attendancesCount: 20,
        averageTimeMinutes: 5,
        createdAt: "2026-06-09",
        updatedAt: "2026-06-09",
      },
    ];

    const whatsappOnly = buildManagementReportData({
      period: "day",
      dateRange: { start: "2026-06-09", end: "2026-06-09", label: "09/06/2026" },
      attendants,
      performanceRecords: records,
      productionGoals,
      options: { channels: "WhatsApp", attendantIds: [2] },
    });

    expect(whatsappOnly.ligacaoRanking).toHaveLength(0);
    expect(whatsappOnly.whatsappRanking).toHaveLength(1);
    expect(whatsappOnly.whatsappRanking[0].name).toBe("Bruno Costa");
    expect(whatsappOnly.filtersLabel).toContain("WhatsApp");
  });
});

describe("managementReportFilename", () => {
  it("usa intervalo quando periodo abrange varios dias", () => {
    const data = buildManagementReportData({
      period: "week",
      dateRange: {
        start: "2026-06-02",
        end: "2026-06-08",
        label: "Semana",
      },
      attendants,
      performanceRecords: [],
      productionGoals,
    });

    expect(managementReportFilename(data)).toBe(
      "relatorio-gerencial-ellos-2026-06-02_2026-06-08.pdf"
    );
  });
});
