import { describe, expect, it } from "vitest";
import { buildProductivityAlerts, evaluateLimit, recordPercents } from "./productivityLimits";
import type { ProductivityLimit, ProductivityRecord } from "@/types/productivity";

const record = (over: Partial<ProductivityRecord>): ProductivityRecord => ({
  id: 1,
  attendantId: 1,
  attendantName: "Ellen",
  periodStart: "2026-10-01",
  periodEnd: "2026-10-29",
  channel: "WhatsApp",
  attendancesCount: 100,
  loginSeconds: 36000,
  pauseUnproductiveSeconds: 3600,
  occupancyTo1: 62.5,
  createdAt: "",
  updatedAt: "",
  ...over,
});

const limit = (metric: ProductivityLimit["metric"], value: number, status: "Ativo" | "Inativo" = "Ativo"): ProductivityLimit => ({
  id: 1, metric, value, status, createdAt: "", updatedAt: "",
});

describe("limites de pausa e ocupação", () => {
  it("avalia máximo e mínimo, com faixa de atenção de 10%", () => {
    expect(evaluateLimit("max", 6, 5)).toBe("red");
    expect(evaluateLimit("max", 4.8, 5)).toBe("yellow");
    expect(evaluateLimit("max", 3, 5)).toBe("green");
    expect(evaluateLimit("min", 60, 70)).toBe("red");
    expect(evaluateLimit("min", 72, 70)).toBe("yellow");
    expect(evaluateLimit("min", 90, 70)).toBe("green");
    expect(evaluateLimit("max", undefined, 5)).toBeUndefined();
    expect(evaluateLimit("max", 6, undefined)).toBeUndefined();
  });

  it("calcula as porcentagens sobre o tempo logado", () => {
    expect(recordPercents(record({}))).toMatchObject({ pause_unproductive_percent: 10, occupancy_min: 62.5 });
  });

  it("gera alerta só para limite ativo e fora do limite", () => {
    const alerts = buildProductivityAlerts([record({})], [
      limit("pause_unproductive_percent", 5),
      limit("occupancy_min", 70, "Inativo"),
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alertLevel).toBe("red");
    expect(alerts[0].message).toContain("Pausa improdutiva: 10%");
    expect(alerts[0].id).toBeLessThan(0);
    expect(buildProductivityAlerts([record({})], [])).toEqual([]);
  });

  it("usa só o relatório mais recente", () => {
    const old = record({ id: 2, periodStart: "2026-09-01", periodEnd: "2026-09-30" });
    const alerts = buildProductivityAlerts([old, record({ pauseUnproductiveSeconds: 0 })], [
      limit("pause_unproductive_percent", 5),
    ]);
    expect(alerts).toEqual([]);
  });
});
