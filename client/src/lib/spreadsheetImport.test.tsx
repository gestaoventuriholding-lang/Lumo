import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import type { Attendant } from "@/types/attendant";
import {
  analyzeImportProfile,
  buildImportPlan,
  detectColumnMapping,
  executePerformanceImport,
  parseSpreadsheetFile,
  pickProductivityCountColumn,
} from "./spreadsheetImport";

function makeCsv(content: string, name = "test.csv"): File {
  return new File([content], name, { type: "text/csv" });
}

function makeXlsx(rows: unknown[][], name = "test.xlsx"): File {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Desempenho");
  const buffer = XLSX.write(book, { type: "array", bookType: "xlsx" });
  return new File([buffer], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function makeWorkbook(
  sheets: Record<string, unknown[][]>,
  name = "Acompanhamento_Diario.xlsx"
): File {
  const book = XLSX.utils.book_new();
  for (const [sheetName, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), sheetName);
  }
  const buffer = XLSX.write(book, { type: "array", bookType: "xlsx" });
  return new File([buffer], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("spreadsheetImport", () => {
  it("parses semicolon CSV and imports performance rows", async () => {
    const csv = [
      "Colaborador;Data;Canal;Quantidade;Tempo Médio",
      "Ana Silva;09/06/2025;WhatsApp;12;3m",
      "Bruno Costa;09/06/2025;Ligação;8;4m 30s",
    ].join("\n");

    const parsed = await parseSpreadsheetFile(makeCsv(csv));
    const mapping = detectColumnMapping(parsed.headers);
    expect(mapping.attendant).toBe("Colaborador");
    expect(mapping.date).toBe("Data");

    const plan = buildImportPlan(parsed.rows, mapping, [], [], {
      createAttendants: true,
      updateDuplicates: true,
    });

    expect(plan.errors).toHaveLength(0);
    expect(plan.stats.newRecords).toBe(2);

    const outcome = executePerformanceImport(plan, [], [], {
      createAttendants: true,
      updateDuplicates: true,
    });

    expect(outcome.result.imported).toBe(2);
    expect(outcome.result.createdAttendants).toBe(2);
  });

  it("parses xlsx with excel date serial and formatted headers", async () => {
    const file = makeXlsx([
      ["Colaborador", "Data", "Canal", "Quantidade", "Tempo Médio"],
      ["Ana Silva", new Date(2025, 5, 9), "WhatsApp", 15, ""],
      ["Bruno Costa", 45234, "Ligação", 5, "3:30"],
    ]);

    const parsed = await parseSpreadsheetFile(file);
    const mapping = detectColumnMapping(parsed.headers);
    const plan = buildImportPlan(parsed.rows, mapping, [], [], {
      createAttendants: true,
      updateDuplicates: true,
    });

    expect(plan.errors).toHaveLength(0);
    expect(plan.valid).toHaveLength(2);
    expect(plan.valid[1]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(plan.valid[1]?.averageTimeMinutes).toBeCloseTo(3.5, 1);
  });

  it("handles exported lumo round-trip", async () => {
    const csv = [
      "Colaborador,Data,Canal,Quantidade,Tempo Médio",
      "Ana Silva,09/06/2025,WhatsApp,10,3m 15s",
    ].join("\n");

    const parsed = await parseSpreadsheetFile(makeCsv(csv));
    const mapping = detectColumnMapping(parsed.headers);
    const plan = buildImportPlan(parsed.rows, mapping, [], [], {
      createAttendants: true,
      updateDuplicates: true,
    });

    expect(plan.errors).toHaveLength(0);
    expect(plan.valid[0]?.channel).toBe("WhatsApp");
  });

  it("skips title row in daily tracking spreadsheets", async () => {
    const file = makeXlsx([
      ["Ligação REL 067", "", "", "", ""],
      ["Agente", "Data", "Canal", "Qtd Atendimentos", "TMA"],
      ["Ana Silva", "09/06/2025", "WhatsApp", 10, "3:30"],
      ["Bruno Costa", "10/06/2025", "Ligação", 8, "4:00"],
    ]);

    const parsed = await parseSpreadsheetFile(file);
    expect(parsed.headers).toEqual([
      "Agente",
      "Data",
      "Canal",
      "Qtd Atendimentos",
      "TMA",
    ]);

    const mapping = detectColumnMapping(parsed.headers);
    expect(mapping.attendant).toBe("Agente");
    expect(mapping.date).toBe("Data");
    expect(mapping.channel).toBe("Canal");
    expect(mapping.count).toBe("Qtd Atendimentos");

    const plan = buildImportPlan(parsed.rows, mapping, [], [], {
      createAttendants: true,
      updateDuplicates: true,
    });

    expect(plan.errors).toHaveLength(0);
    expect(plan.valid).toHaveLength(2);
  });

  it("does not map rel summary metrics to colaborador", () => {
    const headers = [
      "Data",
      "Recebida",
      "Atendida",
      "%",
      "Abandonadas Unicas",
      "Recuperadas",
    ];
    const mapping = detectColumnMapping(headers);
    expect(mapping.date).toBe("Data");
    expect(mapping.count).toBe("Atendida");
    expect(mapping.attendant).toBeNull();
    expect(mapping.channel).toBeNull();
  });

  it("imports rel summary spreadsheets in consolidated mode", async () => {
    const headers = ["Data", "Recebida", "Atendida"];
    const rows = [
      { Data: "09/06/2025", Recebida: "120", Atendida: "95" },
      { Data: "10/06/2025", Recebida: "110", Atendida: "88" },
    ];
    const mapping = detectColumnMapping(headers);
    const plan = buildImportPlan(rows, mapping, [], [], {
      createAttendants: true,
      updateDuplicates: true,
      consolidated: true,
      consolidatedAttendantName: "Ligação REL 067",
      consolidatedChannel: "Ligação",
    });

    expect(plan.errors).toHaveLength(0);
    expect(plan.valid).toHaveLength(2);
    expect(plan.valid[0]?.attendantName).toBe("Ligação REL 067");
    expect(plan.valid[0]?.channel).toBe("Ligação");
    expect(plan.valid[0]?.attendancesCount).toBe(95);
  });

  it("detects rel summary profile from headers", () => {
    const analysis = analyzeImportProfile(
      ["Data", "Recebida", "Atendida", "Taxa de perda"],
      "Acompanhamento_Diario_REL_067.xlsx"
    );
    expect(analysis.profile).toBe("rel_summary");
    expect(analysis.suggestedChannel).toBe("Ligação");
  });

  it("imports acompanhamento diario productivity tabs per person", async () => {
    const file = makeWorkbook({
      Voz: [
        ["Ligação REL 067"],
        ["Data", "Recebida", "Atendida"],
        ["2026-06-01", 100, 50],
      ],
      "Voz Prod": [
        ["Protutividade Voz REL025"],
        ["Data", "Nome", "Oferecidas", "Atendidas", "TMA"],
        ["2026-06-01", "Ana Silva", 0, 76, new Date(1899, 11, 30, 0, 4, 7)],
        ["2026-06-01", "Bruno Costa", 0, 0, ""],
        ["2026-06-02", "Ana Silva", 0, 57, new Date(1899, 11, 30, 0, 3, 15)],
      ],
      Chat: [
        ["Chat REL091"],
        ["Data", "Recebida"],
        ["2026-06-01", 200],
      ],
      "Chat Prod": [
        ["REL 090"],
        ["Data", "Nome", "Entrada", "TMA"],
        ["2026-06-01", "Ana Silva", 58, new Date(1899, 11, 30, 0, 3, 13)],
        ["2026-06-01", "Bruno Costa", 0, ""],
      ],
    });

    const parsed = await parseSpreadsheetFile(file);
    expect(parsed.sourceSheets?.map((s) => `${s.name}:${s.role}`).sort()).toEqual([
      "Chat Prod:productivity",
      "Chat:summary",
      "Voz Prod:productivity",
      "Voz:summary",
    ]);

    const mapping = detectColumnMapping(parsed.headers);
    expect(mapping.attendant).toBe("Colaborador");
    expect(mapping.count).toBe("Quantidade");
    expect(mapping.channel).toBe("Canal");

    const plan = buildImportPlan(parsed.rows, mapping, [], [], {
      createAttendants: true,
      updateDuplicates: true,
    });

    expect(plan.errors).toHaveLength(0);
    expect(plan.valid.length).toBeGreaterThanOrEqual(5);

    const anaVoice = plan.valid.find(
      (row) => row.attendantName === "Ana Silva" && row.channel === "Ligação"
    );
    const chatSummary = plan.valid.find(
      (row) =>
        row.attendantName === "Chat REL091" &&
        row.channel === "WhatsApp" &&
        row.date === "2026-06-01"
    );
    expect(anaVoice?.attendancesCount).toBe(76);
    expect(chatSummary?.attendancesCount).toBe(200);

    const analysis = analyzeImportProfile(parsed);
    expect(analysis.profile).toBe("acompanhamento_diario");
    expect(analysis.preview?.ligacaoTotal).toBe(107);
    expect(analysis.preview?.whatsappTotal).toBe(200);
    expect(analysis.preview?.ligacaoRows).toBe(2);
    expect(analysis.preview?.whatsappRows).toBe(1);
    expect(analysis.summaryReference?.ligacao?.total).toBe(50);
    expect(analysis.summaryReference?.whatsapp?.total).toBe(200);
  });

  it("ignores percent columns when picking productivity count", () => {
    const headers = ["Data", "Nome", "% Atendidas", "Atendidas", "Entrada"];
    expect(pickProductivityCountColumn(headers)).toBe("Atendidas");
  });

  it("sums entrada and saida for chat productivity rows", async () => {
    const file = makeWorkbook({
      "Chat Prod": [
        ["REL 090"],
        ["Data", "Nome", "Entrada", "Saída", "TMA"],
        ["2026-06-01", "Ana Silva", 50, 10, ""],
      ],
    });

    const parsed = await parseSpreadsheetFile(file);
    expect(parsed.rows[0]?.Quantidade).toBe("60");
  });

  it("does not map every field to a report title column", () => {
    const mapping = detectColumnMapping(["Ligação REL 067"]);
    expect(mapping.channel).toBe("Ligação REL 067");
    expect(mapping.attendant).toBeNull();
    expect(mapping.date).toBeNull();
    expect(mapping.count).toBeNull();
  });

  it("ignora dias já importados quando onlyNewDays está ativo", () => {
    const rows = [
      {
        Colaborador: "Ana Silva",
        Data: "09/06/2025",
        Canal: "WhatsApp",
        Quantidade: "10",
      },
      {
        Colaborador: "Ana Silva",
        Data: "10/06/2025",
        Canal: "WhatsApp",
        Quantidade: "12",
      },
    ];
    const mapping = detectColumnMapping(Object.keys(rows[0]));
    const existingRecords = [
      {
        id: 1,
        attendantId: 1,
        attendantName: "Ana Silva",
        date: "2025-06-09",
        channel: "WhatsApp" as const,
        attendancesCount: 8,
        averageTimeMinutes: 3,
        createdAt: "",
        updatedAt: "",
      },
    ];
    const attendants: Attendant[] = [
      {
        id: 1,
        name: "Ana Silva",
        role: "Atendente",
        serviceChannel: "Ligação",
        workingHours: "08h00",
        jornadaStart: "",
        jornadaEnd: "",
        observation: "",
        registrationDate: "2025-01-01",
      },
    ];

    const plan = buildImportPlan(rows, mapping, attendants, existingRecords, {
      createAttendants: false,
      updateDuplicates: false,
      onlyNewDays: true,
    });

    expect(plan.stats.skippedExistingDays).toBe(1);
    expect(plan.stats.newRecords).toBe(1);
    expect(plan.valid.find((row) => row.date === "2025-06-10")?.status).toBe("new");
    expect(plan.valid.find((row) => row.date === "2025-06-09")?.status).toBe("skip");
  });

  it("bloqueia colaboradores não cadastrados quando createAttendants é false", () => {
    const rows = [
      {
        Colaborador: "Pessoa Nova",
        Data: "09/06/2025",
        Canal: "Ligação",
        Quantidade: "5",
      },
    ];
    const mapping = detectColumnMapping(Object.keys(rows[0]));
    const plan = buildImportPlan(rows, mapping, [], [], {
      createAttendants: false,
      updateDuplicates: false,
      onlyNewDays: true,
    });

    expect(plan.stats.unknownAttendants).toEqual(["Pessoa Nova"]);
    expect(plan.errors.some((error) => error.message.includes("não cadastrado"))).toBe(true);
    expect(plan.stats.newRecords).toBe(0);
  });

  it("gera log com registros e colaboradores únicos", () => {
    const rows = [
      {
        Colaborador: "Ana Silva",
        Data: "09/06/2025",
        Canal: "WhatsApp",
        Quantidade: "10",
      },
      {
        Colaborador: "Bruno Costa",
        Data: "09/06/2025",
        Canal: "Ligação",
        Quantidade: "8",
      },
    ];
    const mapping = detectColumnMapping(Object.keys(rows[0]));
    const plan = buildImportPlan(rows, mapping, [], [], {
      createAttendants: true,
      updateDuplicates: false,
      onlyNewDays: true,
    });
    const outcome = executePerformanceImport(plan, [], [], {
      createAttendants: true,
      updateDuplicates: false,
      onlyNewDays: true,
    });

    expect(outcome.result.imported).toBe(2);
    expect(outcome.result.uniqueAttendants).toBe(2);
    expect(outcome.result.logMessage).toContain("Importados 2 registros de 2 colaboradores");
  });

  it("sincroniza o canal do colaborador com o canal importado na planilha", () => {
    const rows = [
      {
        Colaborador: "Ana Silva",
        Data: "09/06/2025",
        Canal: "WhatsApp",
        Quantidade: "10",
      },
    ];
    const mapping = detectColumnMapping(Object.keys(rows[0]));
    const attendants: Attendant[] = [
      {
        id: 1,
        name: "Ana Silva",
        role: "Atendente",
        serviceChannel: "Ligação" as const,
        workingHours: "08h00",
        jornadaStart: "",
        jornadaEnd: "",
        observation: "",
        registrationDate: "2025-01-01",
      },
    ];
    const plan = buildImportPlan(rows, mapping, attendants, [], {
      createAttendants: false,
      updateDuplicates: false,
      onlyNewDays: true,
    });
    const outcome = executePerformanceImport(plan, attendants, [], {
      createAttendants: false,
      updateDuplicates: false,
      onlyNewDays: true,
    });

    expect(outcome.attendants[0]?.serviceChannel).toBe("WhatsApp");
    expect(outcome.performanceRecords[0]?.channel).toBe("WhatsApp");
  });

  it("cadastra colaborador novo já com o canal da planilha", () => {
    const rows = [
      {
        Colaborador: "Carla Nova",
        Data: "09/06/2025",
        Canal: "Ligação",
        Quantidade: "15",
      },
    ];
    const mapping = detectColumnMapping(Object.keys(rows[0]));
    const plan = buildImportPlan(rows, mapping, [], [], {
      createAttendants: true,
      updateDuplicates: false,
      onlyNewDays: true,
    });
    const outcome = executePerformanceImport(plan, [], [], {
      createAttendants: true,
      updateDuplicates: false,
      onlyNewDays: true,
    });

    expect(outcome.attendants[0]?.name).toBe("Carla Nova");
    expect(outcome.attendants[0]?.serviceChannel).toBe("Ligação");
  });

  it("imports real acompanhamento diario workbook when available", async () => {
    const { existsSync, readFileSync } = await import("fs");
    const paths = [
      "c:/Users/amnds/Downloads/Acompanhamento_Diario (1).xlsx",
      "c:/Users/amnds/Documents/Automatização planilha/Acompanhamento_Diario.xlsx",
    ];
    const path = paths.find((candidate) => existsSync(candidate));
    if (!path) return;

    const file = new File([readFileSync(path)], "Acompanhamento_Diario.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const parsed = await parseSpreadsheetFile(file);
    expect(parsed.sourceSheets?.length).toBe(4);
    expect(parsed.rows.length).toBeGreaterThan(50);

    const analysis = analyzeImportProfile(parsed);
    expect(analysis.profile).toBe("acompanhamento_diario");
    expect(analysis.preview?.uniqueAttendants).toBeGreaterThan(10);

    const mapping = detectColumnMapping(parsed.headers);
    const plan = buildImportPlan(parsed.rows, mapping, [], [], {
      createAttendants: true,
      updateDuplicates: false,
      onlyNewDays: true,
    });
    expect(plan.errors.length).toBeLessThan(5);
    expect(plan.valid.length).toBeGreaterThan(50);
    expect(new Set(plan.valid.map((row) => row.attendantName)).size).toBeGreaterThan(10);
  });
});
