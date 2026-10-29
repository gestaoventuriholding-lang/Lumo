import { describe, expect, it } from "vitest";
import { countWeekdays, findHiddenPeriodTotals, mergePeriodTotals } from "./periodTotals";
import { buildAttendantSummaries, buildAttendancesTrend, buildChannelAttendanceTotals } from "./performanceMetrics";
import type { ProductivityRecord } from "@/types/productivity";
import type { Attendant } from "@/types/attendant";
import type { ProductionGoal } from "@/types/goals";

const total: ProductivityRecord = {
  id: 7,
  attendantId: 1,
  attendantName: "Ellen",
  periodStart: "2026-10-01",
  periodEnd: "2026-10-29",
  channel: "WhatsApp",
  attendancesCount: 1486,
  tmaSeconds: 256,
  createdAt: "",
  updatedAt: "",
};
const ellen: Attendant = {
  id: 1,
  name: "Ellen",
  role: "Atendente",
  serviceChannel: "WhatsApp",
  workingHours: "",
  jornadaStart: "",
  jornadaEnd: "",
  observation: "",
  registrationDate: "2026-01-01",
};
const month = { start: "2026-10-01", end: "2026-10-31", label: "Outubro" };

describe("mergePeriodTotals", () => {
  it("conta dias úteis", () => {
    expect(countWeekdays("2026-10-01", "2026-10-29")).toBe(21);
  });

  it("total do período entra em rankings e totais quando cabe no filtro", () => {
    const merged = mergePeriodTotals([], [total], month);
    expect(merged).toHaveLength(1);
    expect(buildChannelAttendanceTotals(merged, month).whatsapp).toBe(1486);
    const [row] = buildAttendantSummaries(merged, [ellen], [], month, "WhatsApp");
    expect(row.totalAttendances).toBe(1486);
    expect(row.averageTimeMinutes).toBeCloseTo(4.27, 1);
  });

  it("não entra quando o filtro é menor que o período do relatório", () => {
    const week = { start: "2026-10-26", end: "2026-10-31", label: "Semana" };
    expect(mergePeriodTotals([], [total], week)).toHaveLength(0);
  });

  it("não duplica quem já tem registros diários no período", () => {
    const daily = [
      {
        id: 1, attendantId: 1, attendantName: "Ellen", date: "2026-10-05", channel: "WhatsApp" as const,
        attendancesCount: 50, averageTimeMinutes: 4, createdAt: "", updatedAt: "",
      },
    ];
    expect(mergePeriodTotals(daily, [total], month)).toHaveLength(1);
  });

  it("meta multiplica pelos dias úteis e o total fica fora do gráfico diário", () => {
    const goal = { channel: "WhatsApp", status: "Ativo", dailyTarget: 70 } as ProductionGoal;
    const merged = mergePeriodTotals([], [total], month);
    const [row] = buildAttendantSummaries(merged, [ellen], [goal], month, "WhatsApp");
    expect(row.averagePercentage).toBeCloseTo((1486 / (70 * 21)) * 100, 1);
    expect(buildAttendancesTrend(merged, month)).toHaveLength(0);
  });
});

describe("findHiddenPeriodTotals", () => {
  it("avisa quando o filtro é menor que o período do relatório", () => {
    const week = { start: "2026-10-05", end: "2026-10-11" };
    expect(findHiddenPeriodTotals([], [total], week)).toEqual([
      { periodStart: "2026-10-01", periodEnd: "2026-10-29", attendances: 1486 },
    ]);
  });

  it("não avisa quando o relatório cabe no filtro ou está fora dele", () => {
    expect(findHiddenPeriodTotals([], [total], month)).toEqual([]);
    expect(findHiddenPeriodTotals([], [total], { start: "2026-11-02", end: "2026-11-08" })).toEqual([]);
  });
});
