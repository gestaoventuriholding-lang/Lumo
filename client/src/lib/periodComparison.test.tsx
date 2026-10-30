import { describe, expect, it } from "vitest";
import { describeChange, previousRange } from "./periodComparison";

describe("comparação com o período anterior", () => {
  it("mês fechado volta para o mês anterior inteiro", () => {
    expect(previousRange({ start: "2026-10-01", end: "2026-10-31" })).toMatchObject({
      start: "2026-09-01",
      end: "2026-09-30",
      name: "mês anterior",
    });
    expect(previousRange({ start: "2026-03-01", end: "2026-03-31" })).toMatchObject({
      start: "2026-02-01",
      end: "2026-02-28",
    });
  });

  it("semana e dia voltam pelo mesmo tamanho", () => {
    expect(previousRange({ start: "2026-10-26", end: "2026-11-01" })).toMatchObject({
      start: "2026-10-19",
      end: "2026-10-25",
      name: "semana anterior",
    });
    expect(previousRange({ start: "2026-10-01", end: "2026-10-01" })).toMatchObject({
      start: "2026-09-30",
      end: "2026-09-30",
      name: "dia anterior",
    });
  });

  it("descreve a variação com tom bom ou ruim", () => {
    expect(describeChange(120, 100, "mês anterior")).toEqual({ text: "▲ 20% vs mês anterior", tone: "good" });
    expect(describeChange(80, 100, "mês anterior")).toEqual({ text: "▼ 20% vs mês anterior", tone: "bad" });
    expect(describeChange(4, 5, "mês anterior", { lowerIsBetter: true }).tone).toBe("good");
    expect(describeChange(90, 85, "mês anterior", { unit: "points" }).text).toBe("▲ 5 p.p. vs mês anterior");
    expect(describeChange(50, 0, "mês anterior").tone).toBe("neutral");
  });
});
