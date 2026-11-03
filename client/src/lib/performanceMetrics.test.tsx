import { describe, expect, it } from "vitest";
import {
  calculatePerformanceScore,
  compareAttendantSummaries,
  buildAttendantSummaries,
  buildAttendancesTrend,
  buildChannelAttendanceTotals,
  buildChannelDistribution,
  type AttendantPerformanceSummary,
} from "./performanceMetrics";
import { chartColors } from "./chartTheme";
import type { Attendant } from "@/types/attendant";
import type { DailyPerformanceRecord } from "@/types/performance";

function summary(
  overrides: Partial<AttendantPerformanceSummary> & Pick<AttendantPerformanceSummary, "attendantId" | "name">
): AttendantPerformanceSummary {
  return {
    role: "Atendente",
    totalAttendances: 0,
    averageTimeMinutes: 0,
    averagePercentage: 0,
    performanceScore: 0,
    ranking: 0,
    ...overrides,
  };
}

describe("calculatePerformanceScore", () => {
  it("premia quem atende mais em menos tempo", () => {
    const volumeOnly = calculatePerformanceScore(120, 6, 100);
    const balanced = calculatePerformanceScore(80, 3, 100);

    expect(balanced).toBeGreaterThan(volumeOnly);
  });

  it("considera atingimento de meta no score", () => {
    const withMeta = calculatePerformanceScore(100, 4, 100);
    const lowMeta = calculatePerformanceScore(100, 4, 50);

    expect(withMeta).toBe(25);
    expect(lowMeta).toBe(12.5);
  });

  it("retorna zero sem atendimentos ou tempo inválido", () => {
    expect(calculatePerformanceScore(0, 4, 100)).toBe(0);
    expect(calculatePerformanceScore(10, 0, 100)).toBe(0);
  });
});

describe("compareAttendantSummaries", () => {
  it("ordena pelo score composto de volume e agilidade", () => {
    const first = summary({
      attendantId: 1,
      name: "Ana",
      totalAttendances: 80,
      averageTimeMinutes: 3,
      averagePercentage: 100,
      performanceScore: calculatePerformanceScore(80, 3, 100),
    });
    const second = summary({
      attendantId: 2,
      name: "Bruno",
      totalAttendances: 120,
      averageTimeMinutes: 6,
      averagePercentage: 100,
      performanceScore: calculatePerformanceScore(120, 6, 100),
    });

    expect(compareAttendantSummaries(first, second)).toBeLessThan(0);
  });
});

describe("buildAttendantSummaries por canal", () => {
  const attendants: Attendant[] = [
    {
      id: 1,
      name: "Ana",
      role: "Atendente",
      serviceChannel: "Ligação" as const,
      workingHours: "08h00",
      jornadaStart: "",
      jornadaEnd: "",
      observation: "",
      registrationDate: "2026-01-01",
    },
  ];

  const records: DailyPerformanceRecord[] = [
    {
      id: 1,
      attendantId: 1,
      attendantName: "Ana",
      date: "2026-06-01",
      channel: "Ligação",
      attendancesCount: 80,
      averageTimeMinutes: 4,
      createdAt: "",
      updatedAt: "",
    },
    {
      id: 2,
      attendantId: 1,
      attendantName: "Ana",
      date: "2026-06-01",
      channel: "WhatsApp",
      attendancesCount: 50,
      averageTimeMinutes: 3,
      createdAt: "",
      updatedAt: "",
    },
  ];

  it("filtra ranking por canal", () => {
    const range = { start: "2026-06-01", end: "2026-06-01", label: "01/06" };
    const ligacao = buildAttendantSummaries(records, attendants, [], range, "Ligação");
    const whatsapp = buildAttendantSummaries(records, attendants, [], range, "WhatsApp");

    expect(ligacao[0].totalAttendances).toBe(80);
    expect(whatsapp[0].totalAttendances).toBe(50);
  });

  it("calcula meta como atendimentos sobre meta total do periodo", () => {
    const goals = [
      {
        id: 1,
        channel: "Ligação" as const,
        dailyTarget: 50,
        status: "Ativo" as const,
        createdAt: "",
        updatedAt: "",
      },
    ];
    const range = { start: "2026-06-01", end: "2026-06-01", label: "01/06" };
    const onTarget = buildAttendantSummaries(
      [
        {
          id: 3,
          attendantId: 1,
          attendantName: "Ana",
          date: "2026-06-01",
          channel: "Ligação",
          attendancesCount: 50,
          averageTimeMinutes: 4,
          createdAt: "",
          updatedAt: "",
        },
      ],
      attendants,
      goals,
      range,
      "Ligação"
    );
    const aboveTarget = buildAttendantSummaries(
      [
        {
          id: 4,
          attendantId: 1,
          attendantName: "Ana",
          date: "2026-06-01",
          channel: "Ligação",
          attendancesCount: 65,
          averageTimeMinutes: 4,
          createdAt: "",
          updatedAt: "",
        },
      ],
      attendants,
      goals,
      range,
      "Ligação"
    );

    expect(onTarget[0].averagePercentage).toBe(100);
    expect(aboveTarget[0].averagePercentage).toBe(130);
  });
});

describe("channel attendance breakdown", () => {
  const range = { start: "2026-06-01", end: "2026-06-02", label: "Jun" };
  const records: DailyPerformanceRecord[] = [
    {
      id: 1,
      attendantId: 1,
      attendantName: "Ana",
      date: "2026-06-01",
      channel: "Ligação",
      attendancesCount: 80,
      averageTimeMinutes: 4,
      createdAt: "",
      updatedAt: "",
    },
    {
      id: 2,
      attendantId: 1,
      attendantName: "Ana",
      date: "2026-06-01",
      channel: "WhatsApp",
      attendancesCount: 50,
      averageTimeMinutes: 3,
      createdAt: "",
      updatedAt: "",
    },
    {
      id: 3,
      attendantId: 1,
      attendantName: "Ana",
      date: "2026-06-02",
      channel: "Ligação",
      attendancesCount: 20,
      averageTimeMinutes: 4,
      createdAt: "",
      updatedAt: "",
    },
  ];

  it("sums totals by channel", () => {
    const totals = buildChannelAttendanceTotals(records, range);
    expect(totals).toEqual({ total: 150, ligacao: 100, whatsapp: 50 });
  });

  it("builds daily trend with channel split", () => {
    const trend = buildAttendancesTrend(records, range);
    expect(trend).toHaveLength(2);
    expect(trend[0]).toMatchObject({
      date: "2026-06-01",
      attendances: 130,
      ligacao: 80,
      whatsapp: 50,
    });
    expect(trend[1]).toMatchObject({
      date: "2026-06-02",
      attendances: 20,
      ligacao: 20,
      whatsapp: 0,
    });
  });

  it("builds channel distribution for dashboard", () => {
    const distribution = buildChannelDistribution(records, range);
    expect(distribution).toEqual([
      { name: "Ligação", value: 100, color: chartColors.ligacao },
      { name: "WhatsApp", value: 50, color: chartColors.whatsapp },
    ]);
  });

  it("deduplicates same collaborator/date/channel before summing", () => {
    const duplicated: DailyPerformanceRecord[] = [
      ...records,
      {
        id: 99,
        attendantId: 2,
        attendantName: "Ana",
        date: "2026-06-01",
        channel: "Ligação",
        attendancesCount: 80,
        averageTimeMinutes: 4,
        createdAt: "",
        updatedAt: "2026-06-03T00:00:00.000Z",
      },
    ];

    const totals = buildChannelAttendanceTotals(duplicated, range);
    expect(totals).toEqual({ total: 150, ligacao: 100, whatsapp: 50 });

    const trend = buildAttendancesTrend(duplicated, range);
    expect(trend[0]?.ligacao).toBe(80);
  });

  it("prefers consolidated daily totals for channel charts", () => {
    const withSummary: DailyPerformanceRecord[] = [
      ...records,
      {
        id: 100,
        attendantId: 99,
        attendantName: "Chat REL091",
        date: "2026-06-01",
        channel: "WhatsApp",
        attendancesCount: 1337,
        averageTimeMinutes: 4,
        createdAt: "",
        updatedAt: "",
      },
    ];

    const totals = buildChannelAttendanceTotals(withSummary, range);
    expect(totals.whatsapp).toBe(1337);
    expect(totals.ligacao).toBe(100);

    const trend = buildAttendancesTrend(withSummary, range);
    expect(trend[0]?.whatsapp).toBe(1337);
  });
});
