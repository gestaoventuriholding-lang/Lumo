import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RELATORIOS_GUARDADOS, RELATORIOS_NA_HORA, diasSemDado, ultimaData } from "./reportCatalog";

describe("tela Relatórios: catálogo", () => {
  it("todo relatório que a sincronização e a auditoria pedem à Escallo está listado", () => {
    const base = join(__dirname, "../../../supabase/functions");
    const fontes = ["escallo-sync/index.ts", "escallo-atendimento/index.ts", "escallo-rel025/index.ts"]
      .map((f) => readFileSync(join(base, f), "utf8"))
      .join("\n");
    const usados = new Set((fontes.match(/rel\d{3}/gi) ?? []).map((r) => r.toUpperCase()));
    const listados = new Set([...RELATORIOS_GUARDADOS, ...RELATORIOS_NA_HORA].map((r) => r.codigo));
    expect([...usados].filter((r) => !listados.has(r))).toEqual([]);
  });

  it("só os guardados têm data do último dado", () => {
    expect(RELATORIOS_GUARDADOS.every((r) => r.fonte && r.guarda)).toBe(true);
    expect(RELATORIOS_NA_HORA.some((r) => r.fonte || r.guarda)).toBe(false);
  });

  it("acha a última data e conta os dias sem dado", () => {
    expect(ultimaData(["2026-11-03", "2026-11-12", "2026-11-09"])).toBe("2026-11-12");
    expect(ultimaData([])).toBeUndefined();
    expect(diasSemDado("2026-11-12", "2026-11-26")).toBe(14);
    expect(diasSemDado("2026-11-26", "2026-11-26")).toBe(0);
  });
});
