import { describe, expect, it } from "vitest";
import { compareAttendantSummaries, type AttendantPerformanceSummary } from "./performanceMetrics";

function s(name: string, total: number, tma: number, pct: number): AttendantPerformanceSummary {
  return { attendantId: 1, name, role: "", totalAttendances: total, averageTimeMinutes: tma, averagePercentage: pct, performanceScore: 0, ranking: 0 };
}
const names = (list: AttendantPerformanceSummary[], c: "goal" | "attendances" | "tma") =>
  [...list].sort((a, b) => compareAttendantSummaries(a, b, c)).map((x) => x.name);

describe("critérios do ranking", () => {
  const list = [s("Ana", 100, 5, 100), s("Bia", 130, 6, 130), s("Caio", 80, 3, 80), s("Dani", 100, 4, 100)];

  it("meta: quem passa de 100% fica na frente; empate decide pelo menor TMA", () => {
    expect(names(list, "goal")).toEqual(["Bia", "Dani", "Ana", "Caio"]);
  });
  it("atendimentos: maior volume primeiro", () => {
    expect(names(list, "attendances")).toEqual(["Bia", "Dani", "Ana", "Caio"]);
  });
  it("TMA: menor tempo primeiro e sem TMA vai para o fim", () => {
    expect(names([...list, s("Eva", 50, 0, 50)], "tma")).toEqual(["Caio", "Dani", "Ana", "Bia", "Eva"]);
  });
});
