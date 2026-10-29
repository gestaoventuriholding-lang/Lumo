import { describe, expect, it } from "vitest";
import type { ProductivityReport, ProductivityRow } from "./reportParser";
import { executeProductivityImport, previewProductivityImport } from "./productivityImport";
import type { Attendant } from "@/types/attendant";

function row(name: string, overrides: Partial<ProductivityRow> = {}): ProductivityRow {
  return {
    attendantName: name,
    inbound: 10,
    outbound: 2,
    total: 12,
    tmaSeconds: 300,
    loginSeconds: 3600 * 8,
    pauseSeconds: 3600,
    occupancy1: 70,
    perHour: 1.5,
    ...overrides,
  };
}

function report(mode: ProductivityReport["mode"], rows: ProductivityRow[]): ProductivityReport {
  return {
    title: "Estatísticas de produtividade por agente - Chat - REL090",
    reportCode: "REL090",
    sheetName: "Sheet3",
    channel: "WhatsApp",
    mode,
    rows,
    recognizedFields: [],
    warnings: [],
  };
}

const ana: Attendant = {
  id: 1,
  name: "Ana Lydya",
  role: "Atendente",
  serviceChannel: "WhatsApp",
  workingHours: "08h00",
  jornadaStart: "",
  jornadaEnd: "",
  observation: "",
  registrationDate: "2026-01-01",
};

const options = {
  channel: "WhatsApp" as const,
  periodStart: "2026-10-01",
  periodEnd: "2026-10-29",
  createAttendants: true,
  fileName: "rel090.xls",
};

describe("executeProductivityImport", () => {
  it("total do período: guarda produtividade e NÃO cria desempenho diário", () => {
    const out = executeProductivityImport(
      report("period", [row("Ana Lydya"), row("Ellen Mesquita")]),
      [ana],
      [],
      [],
      options
    );
    expect(out.productivityRecords).toHaveLength(2);
    expect(out.performanceRecords).toHaveLength(0);
    expect(out.summary.createdAttendants).toBe(1);
    expect(out.attendants.map((a) => a.name)).toContain("Ellen Mesquita");
    expect(out.productivityRecords[0].periodStart).toBe("2026-10-01");
    expect(out.productivityRecords[0].attendancesCount).toBe(12);
  });

  it("casa colaboradores ignorando acento e maiúsculas", () => {
    const out = executeProductivityImport(
      report("period", [row("ANA LYDYA")]),
      [ana],
      [],
      [],
      options
    );
    expect(out.summary.createdAttendants).toBe(0);
    expect(out.productivityRecords[0].attendantId).toBe(1);
  });

  it("importar duas vezes atualiza em vez de duplicar", () => {
    const first = executeProductivityImport(report("period", [row("Ana Lydya")]), [ana], [], [], options);
    const second = executeProductivityImport(
      report("period", [row("Ana Lydya", { total: 99 })]),
      first.attendants,
      first.performanceRecords,
      first.productivityRecords,
      options
    );
    expect(second.productivityRecords).toHaveLength(1);
    expect(second.productivityRecords[0].attendancesCount).toBe(99);
    expect(second.summary.productivityUpdated).toBe(1);
  });

  it("relatório por dia também alimenta o desempenho diário", () => {
    const out = executeProductivityImport(
      report("daily", [row("Ana Lydya", { date: "2026-10-01" }), row("Ana Lydya", { date: "2026-10-02", total: 20 })]),
      [ana],
      [],
      [],
      { ...options, periodStart: undefined, periodEnd: undefined }
    );
    expect(out.productivityRecords).toHaveLength(2);
    expect(out.performanceRecords).toHaveLength(2);
    expect(out.performanceRecords[1].attendancesCount).toBe(20);
    expect(out.performanceRecords[0].averageTimeMinutes).toBe(5);
    expect(out.summary.days).toEqual(["2026-10-01", "2026-10-02"]);
  });

  it("sem criar colaboradores, quem não está cadastrado é listado e não importado", () => {
    const out = executeProductivityImport(
      report("period", [row("Ana Lydya"), row("Pessoa Nova")]),
      [ana],
      [],
      [],
      { ...options, createAttendants: false }
    );
    expect(out.productivityRecords).toHaveLength(1);
    expect(out.summary.unmatchedNames).toEqual(["Pessoa Nova"]);
  });
});

describe("previewProductivityImport", () => {
  it("separa existentes, novos e já importados", () => {
    const imported = executeProductivityImport(report("period", [row("Ana Lydya")]), [ana], [], [], options);
    const preview = previewProductivityImport(
      report("period", [row("Ana Lydya"), row("Ellen Mesquita")]),
      imported.attendants,
      imported.productivityRecords,
      options
    );
    expect(preview.matched).toEqual(["Ana Lydya"]);
    expect(preview.toCreate).toEqual(["Ellen Mesquita"]);
    expect(preview.alreadyImported).toEqual(["Ana Lydya"]);
  });
});
