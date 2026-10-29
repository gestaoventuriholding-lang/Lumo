import { describe, expect, it } from "vitest";
import { summarizeProductivity } from "./productivityMetrics";
import type { ProductivityRecord } from "@/types/productivity";

function record(overrides: Partial<ProductivityRecord>): ProductivityRecord {
  return {
    id: 1,
    attendantId: 1,
    attendantName: "Ana",
    periodStart: "2026-10-01",
    periodEnd: "2026-10-01",
    channel: "WhatsApp",
    attendancesCount: 10,
    inboundCount: 8,
    outboundCount: 2,
    tmaSeconds: 300,
    loginSeconds: 3600 * 8,
    pauseSeconds: 3600,
    occupancyTo1: 50,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("summarizeProductivity", () => {
  it("soma dias do mesmo colaborador e pondera TMA e ocupação", () => {
    const { rows } = summarizeProductivity(
      [
        record({ id: 1, periodStart: "2026-10-01", periodEnd: "2026-10-01" }),
        record({
          id: 2,
          periodStart: "2026-10-02",
          periodEnd: "2026-10-02",
          attendancesCount: 30,
          inboundCount: 30,
          outboundCount: 0,
          tmaSeconds: 100,
          occupancyTo1: 80,
        }),
      ],
      { start: "2026-10-01", end: "2026-10-31" }
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].attendances).toBe(40);
    expect(rows[0].tmaSeconds).toBe(150); // (300*10 + 100*30) / 40
    expect(rows[0].occupancy).toBe(65);
    expect(rows[0].pausePercent).toBe(12.5);
    expect(rows[0].loginSeconds).toBe(3600 * 16);
  });

  it("avisa quando o total do relatório cobre mais que o filtro", () => {
    const { rows, widerPeriods } = summarizeProductivity(
      [record({ periodStart: "2026-10-01", periodEnd: "2026-10-29" })],
      { start: "2026-10-27", end: "2026-10-27" }
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].extendsOutsideRange).toBe(true);
    expect(widerPeriods).toEqual([{ start: "2026-10-01", end: "2026-10-29" }]);
  });

  it("ignora registros fora do período e de colaboradores removidos", () => {
    const { rows } = summarizeProductivity(
      [
        record({ id: 1, periodStart: "2026-09-01", periodEnd: "2026-09-30" }),
        record({ id: 2, attendantId: 99 }),
      ],
      { start: "2026-10-01", end: "2026-10-31" },
      new Set([1])
    );
    expect(rows).toHaveLength(0);
  });
});
