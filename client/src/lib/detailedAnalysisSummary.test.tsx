import { describe, expect, it } from "vitest";
import { buildDetailedAnalysisReport } from "./detailedAnalysisSummary";
import type { Attendant } from "@/types/attendant";
import type { Absence } from "@/types/absence";
import type { DailyPerformanceRecord } from "@/types/performance";
import type { ProductionGoal } from "@/types/goals";

const attendants: Attendant[] = [
  {
    id: 1,
    name: "Ana",
    role: "Atendente",
    serviceChannel: "Ligação" as const,
    workingHours: "08h",
    jornadaStart: "08:00",
    jornadaEnd: "17:00",
    observation: "",
    registrationDate: "2026-01-01",
  },
  {
    id: 2,
    name: "Bruno",
    role: "Atendente",
    serviceChannel: "Ligação" as const,
    workingHours: "08h",
    jornadaStart: "08:00",
    jornadaEnd: "17:00",
    observation: "",
    registrationDate: "2026-01-01",
  },
];

const goals: ProductionGoal[] = [
  { id: 1, channel: "Ligação", dailyTarget: 70, status: "Ativo", createdAt: "", updatedAt: "" },
  { id: 2, channel: "WhatsApp", dailyTarget: 75, status: "Ativo", createdAt: "", updatedAt: "" },
];

const range = { start: "2026-06-01", end: "2026-06-30", label: "Junho 2026" };

function record(
  overrides: Partial<DailyPerformanceRecord> &
    Pick<DailyPerformanceRecord, "date" | "attendantId" | "channel" | "attendancesCount">
): DailyPerformanceRecord {
  return {
    id: Math.random(),
    attendantName: overrides.attendantId === 1 ? "Ana" : "Bruno",
    averageTimeMinutes: 4,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildDetailedAnalysisReport", () => {
  it("retorna vazio sem registros no período", () => {
    const report = buildDetailedAnalysisReport([], attendants, goals, [], range, "no mês selecionado");
    expect(report.hasData).toBe(false);
    expect(report.criticalDays).toHaveLength(0);
    expect(report.bestDays).toHaveLength(0);
  });

  it("prioriza meta individual e destaca dia com mais colaboradores abaixo da meta", () => {
    const records: DailyPerformanceRecord[] = [
      record({ date: "2026-06-02", attendantId: 1, channel: "Ligação", attendancesCount: 20 }),
      record({ date: "2026-06-02", attendantId: 2, channel: "Ligação", attendancesCount: 18 }),
      record({ date: "2026-06-10", attendantId: 1, channel: "Ligação", attendancesCount: 80 }),
      record({ date: "2026-06-10", attendantId: 2, channel: "Ligação", attendancesCount: 75 }),
      record({ date: "2026-06-10", attendantId: 1, channel: "WhatsApp", attendancesCount: 70 }),
    ];

    const report = buildDetailedAnalysisReport(
      records,
      attendants,
      goals,
      [],
      range,
      "no mês selecionado"
    );

    expect(report.hasData).toBe(true);
    expect(report.criticalDays[0]?.date).toBe("2026-06-02");
    expect(report.criticalDays[0]?.paragraphs.some((p) => p.includes("2 colaborador(es)"))).toBe(true);
    expect(report.criticalDays[0]?.paragraphs.some((p) => p.includes("O total varia conforme o dia"))).toBe(true);
    expect(report.bestDays[0]?.date).toBe("2026-06-10");
    expect(report.periodInsights.some((item) => item.includes("mais de um colaborador"))).toBe(true);
  });

  it("inclui observação do gestor no relatório", () => {
    const records: DailyPerformanceRecord[] = [
      record({ date: "2026-06-03", attendantId: 1, channel: "Ligação", attendancesCount: 10 }),
    ];

    const report = buildDetailedAnalysisReport(
      records,
      attendants,
      goals,
      [],
      range,
      "no mês selecionado",
      "Sábado com fluxo menor é normal."
    );

    expect(report.managerNote).toBe("Sábado com fluxo menor é normal.");
  });

  it("não marca dia crítico só por volume baixo se a meta foi batida", () => {
    const records: DailyPerformanceRecord[] = [
      record({ date: "2026-06-06", attendantId: 1, channel: "Ligação", attendancesCount: 80 }),
      record({ date: "2026-06-06", attendantId: 2, channel: "Ligação", attendancesCount: 75 }),
      record({ date: "2026-06-02", attendantId: 1, channel: "Ligação", attendancesCount: 20 }),
    ];

    const report = buildDetailedAnalysisReport(
      records,
      attendants,
      goals,
      [],
      range,
      "no mês selecionado"
    );

    expect(report.criticalDays.some((day) => day.date === "2026-06-06")).toBe(false);
    expect(report.criticalDays[0]?.date).toBe("2026-06-02");
  });
});
