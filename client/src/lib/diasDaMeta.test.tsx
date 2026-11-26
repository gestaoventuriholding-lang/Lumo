import { describe, expect, it } from "vitest";
import { contaNaMeta, ehDiaDeMeta, sextaFeiraSanta } from "./diasDaMeta";
import { buildAttendantSummaries, buildDashboardStats, percentualDaMeta, somarMeta } from "./performanceMetrics";
import { kpisFromSummaries } from "./periodComparison";
import type { Attendant } from "@/types/attendant";
import type { DailyPerformanceRecord } from "@/types/performance";
import type { ProductionGoal } from "@/types/goals";

// Dados inventados.
const metas = [
  { id: 1, channel: "Ligação", dailyTarget: 70, status: "Ativo", createdAt: "", updatedAt: "" },
  { id: 2, channel: "WhatsApp", dailyTarget: 75, status: "Ativo", createdAt: "", updatedAt: "" },
] as ProductionGoal[];
const pessoa = (id: number, name: string): Attendant => ({
  id, name, role: "Atendente", serviceChannel: "Ligação", workingHours: "6 horas", jornadaStart: "08:00", jornadaEnd: "14:00", observation: "", registrationDate: "2026-01-01",
});
const reg = (id: number, attendantId: number, nome: string, date: string, n: number, channel: "Ligação" | "WhatsApp" = "Ligação"): DailyPerformanceRecord => ({
  id, attendantId, attendantName: nome, date, channel, attendancesCount: n, averageTimeMinutes: 3, createdAt: "", updatedAt: "",
});

describe("dias que contam para a meta", () => {
  it("segunda a sexta conta; sábado, domingo e feriado nacional não", () => {
    expect(ehDiaDeMeta("2026-11-03")).toBe(true); // terça
    expect(ehDiaDeMeta("2026-11-07")).toBe(false); // sábado
    expect(ehDiaDeMeta("2026-11-08")).toBe(false); // domingo
    expect(ehDiaDeMeta("2026-11-02")).toBe(false); // Finados (segunda)
    expect(ehDiaDeMeta("2026-11-20")).toBe(false); // Consciência Negra (sexta)
  });

  it("Sexta-feira Santa muda a cada ano", () => {
    expect(sextaFeiraSanta(2025)).toBe("2025-04-18");
    expect(sextaFeiraSanta(2026)).toBe("2026-04-03");
    expect(ehDiaDeMeta("2026-04-03")).toBe(false);
  });

  it("o dia em andamento só conta quando o período é só hoje", () => {
    expect(contaNaMeta("2026-11-26", { start: "2026-11-01" }, "2026-11-26")).toBe(false);
    expect(contaNaMeta("2026-11-26", { start: "2026-11-26" }, "2026-11-26")).toBe(true);
    expect(contaNaMeta("2026-11-25", { start: "2026-11-01" }, "2026-11-26")).toBe(true);
  });
});

describe("Meta Média: atendimentos ÷ meta somada", () => {
  const periodo = { start: "2026-11-01", end: "2026-11-30", label: "nov" };
  const equipe = [pessoa(1, "Ana Teste"), pessoa(2, "Bia Teste")];
  const registros = [
    reg(1, 1, "Ana Teste", "2026-11-03", 70), // 100%
    reg(2, 1, "Ana Teste", "2026-11-04", 35), // 50%
    reg(3, 1, "Ana Teste", "2026-11-07", 5), // sábado: fora
    reg(4, 2, "Bia Teste", "2026-11-03", 75, "WhatsApp"), // 100%
    reg(5, 2, "Bia Teste", "2026-11-02", 2), // feriado: fora
  ];

  it("soma atendimentos e metas só dos dias que contam", () => {
    const m = somarMeta(registros, metas, periodo, "2026-11-30");
    expect(m).toEqual({ goalAttendances: 180, goalTarget: 215 });
    expect(percentualDaMeta(m)).toBeCloseTo((180 / 215) * 100, 5);
  });

  it("Dashboard e Desempenho mostram o mesmo número; os totais continuam com todos os dias", () => {
    const dashboard = buildDashboardStats(equipe, registros, metas, periodo);
    const resumos = buildAttendantSummaries(registros, equipe, metas, periodo);
    const desempenho = kpisFromSummaries(resumos);
    expect(dashboard.averagePercentage).toBeCloseTo((180 / 215) * 100, 5);
    expect(desempenho.averagePercentage).toBeCloseTo(dashboard.averagePercentage, 5);
    expect(dashboard.totalAttendances).toBe(187);
    expect(desempenho.totalAttendances).toBe(187);
    expect(resumos.find((r) => r.name === "Ana Teste")?.averagePercentage).toBeCloseTo(75, 5);
  });

  it("período só de sábado não tem meta", () => {
    const sabado = { start: "2026-11-07", end: "2026-11-07", label: "sáb" };
    expect(buildDashboardStats(equipe, registros, metas, sabado).averagePercentage).toBe(0);
  });
});
