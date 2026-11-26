import { describe, expect, it } from "vitest";
import { formatAverageTime } from "./performanceStorage";

describe("tempo médio na tela", () => {
  it("nunca mostra 60 segundos: passa para o minuto seguinte", () => {
    expect(formatAverageTime(3.9999)).toBe("4m");
    expect(formatAverageTime(239.6 / 60)).toBe("4m");
    expect(formatAverageTime(59.7 / 60)).toBe("1m");
  });

  it("mantém os casos normais", () => {
    expect(formatAverageTime(4)).toBe("4m");
    expect(formatAverageTime(4.55)).toBe("4m 33s");
    expect(formatAverageTime(0.5)).toBe("0m 30s");
  });
});
