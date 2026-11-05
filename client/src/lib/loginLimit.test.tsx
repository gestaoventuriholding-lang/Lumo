import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOGIN_MAX_HOURS,
  LOGIN_ALERT_MESSAGE,
  applyLoginRule,
  buildLoginAlerts,
  exceedsLoginLimit,
  formatLoginDuration,
  loginLimitSeconds,
  withoutLoginFields,
} from "./loginLimit";
import { executeProductivityImport } from "./productivityImport";
import type { ProductivityReport, ProductivityRow } from "./reportParser";
import type { Attendant } from "@/types/attendant";
import type { LoginAlert } from "@/types/loginAlert";
import type { ProductivityLimit, ProductivityRecord } from "@/types/productivity";

// Todos os dados abaixo são inventados.
const H = 3600;
const NOW = "2026-11-05T10:00:00.000Z";

function record(over: Partial<ProductivityRecord> = {}): ProductivityRecord {
  return {
    id: 1,
    attendantId: 1,
    attendantName: "Agente Teste Um",
    periodStart: "2026-10-26",
    periodEnd: "2026-10-26",
    channel: "WhatsApp",
    inboundCount: 50,
    outboundCount: 2,
    attendancesCount: 52,
    talkSeconds: 9000,
    tmaSeconds: 170,
    loginSeconds: 18 * H + 11 * 60,
    pauseSeconds: 3000,
    pausePercent: 4.5,
    pauseLegalSeconds: 1000,
    pauseProductiveSeconds: 1000,
    pauseUnproductiveSeconds: 1000,
    occupancyTo1: 60,
    occupancyTo2: 61,
    occupancyTo3: 62,
    occupancyTo4: 63,
    perHour: 2.9,
    reportCode: "REL090",
    sourceFile: "teste.xls",
    createdAt: "2026-10-27",
    updatedAt: "2026-10-27",
    ...over,
  };
}

function limit(over: Partial<ProductivityLimit> = {}): ProductivityLimit {
  return { id: 9, metric: "login_max_hours", value: 10, status: "Ativo", createdAt: "2026-11-05", updatedAt: "2026-11-05", ...over };
}

function alert(over: Partial<LoginAlert> = {}): LoginAlert {
  return {
    id: 100,
    attendantId: 1,
    attendantName: "Agente Teste Um",
    date: "2026-10-26",
    loginSeconds: 18 * H,
    limitSeconds: 12 * H,
    status: "open",
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

describe("limite de login: configuração", () => {
  it("sem nada cadastrado vale 12 horas; limite ligado vale o valor; desligado desliga a regra", () => {
    expect(loginLimitSeconds([])).toBe(DEFAULT_LOGIN_MAX_HOURS * H);
    expect(loginLimitSeconds([limit({ value: 10 })])).toBe(10 * H);
    expect(loginLimitSeconds([limit({ value: 9.5 })])).toBe(9.5 * H);
    expect(loginLimitSeconds([limit({ status: "Inativo" })])).toBeNull();
  });
  it("limites de pausa e ocupação não mexem na regra do login", () => {
    expect(loginLimitSeconds([limit({ metric: "pause_percent", value: 5 })])).toBe(12 * H);
  });
  it("só passa quem ultrapassa: no limite exato não conta", () => {
    expect(exceedsLoginLimit(12 * H, 12 * H)).toBe(false);
    expect(exceedsLoginLimit(12 * H + 1, 12 * H)).toBe(true);
    expect(exceedsLoginLimit(undefined, 12 * H)).toBe(false);
    expect(exceedsLoginLimit(99 * H, null)).toBe(false);
  });
  it("formata a duração", () => {
    expect(formatLoginDuration(18 * H + 11 * 60)).toBe("18h11");
    expect(formatLoginDuration(53 * H + 24 * 60)).toBe("53h24");
  });
});

describe("limite de login: esvaziar os campos", () => {
  it("tira login, pausa, ocupação e chamadas por hora e mantém atendimentos, TMA e conversa", () => {
    const r = withoutLoginFields(record());
    expect(r).toMatchObject({
      loginSeconds: undefined,
      pauseSeconds: undefined,
      pausePercent: undefined,
      pauseLegalSeconds: undefined,
      pauseProductiveSeconds: undefined,
      pauseUnproductiveSeconds: undefined,
      occupancyTo1: undefined,
      occupancyTo2: undefined,
      occupancyTo3: undefined,
      occupancyTo4: undefined,
      perHour: undefined,
      attendancesCount: 52,
      inboundCount: 50,
      outboundCount: 2,
      tmaSeconds: 170,
      talkSeconds: 9000,
    });
  });
});

describe("limite de login: aplicar a regra", () => {
  it("esvazia o dia nos DOIS canais e gera um alerta (com o tempo que veio da Escallo)", () => {
    const records = [
      record({ id: 1, channel: "WhatsApp" }),
      record({ id: 2, channel: "Ligação", loginSeconds: 18 * H + 11 * 60 }),
      record({ id: 3, attendantId: 2, attendantName: "Agente Teste Dois", loginSeconds: 8 * H }), // normal
    ];
    const out = applyLoginRule(records, [], 12 * H, { now: NOW, makeId: () => 555 });
    expect(out.records[0].loginSeconds).toBeUndefined();
    expect(out.records[1].loginSeconds).toBeUndefined();
    expect(out.records[2].loginSeconds).toBe(8 * H); // quem está normal não muda
    expect(out.records[0].attendancesCount).toBe(52);
    expect(out.alerts).toEqual([
      {
        id: 555,
        attendantId: 1,
        attendantName: "Agente Teste Um",
        date: "2026-10-26",
        loginSeconds: 18 * H + 11 * 60,
        limitSeconds: 12 * H,
        status: "open",
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);
    expect(out.flagged).toHaveLength(1);
  });

  it("não duplica nem reabre um alerta que já existe", () => {
    const existente = alert({ status: "resolved" });
    const out = applyLoginRule([record()], [existente], 12 * H, { now: NOW });
    expect(out.alerts).toHaveLength(1);
    expect(out.alerts[0].status).toBe("resolved");
    expect(out.records[0].loginSeconds).toBeUndefined();
  });

  it("regra desligada (null) ou login dentro do limite não muda nada", () => {
    const records = [record({ loginSeconds: 11 * H })];
    expect(applyLoginRule(records, [], 12 * H).records).toBe(records);
    const desligada = applyLoginRule([record()], [], null);
    expect(desligada.records[0].loginSeconds).toBe(18 * H + 11 * 60);
    expect(desligada.alerts).toEqual([]);
  });

  it("não mexe em relatório de período (várias datas): o login ali é a soma de vários dias", () => {
    const periodo = record({ periodStart: "2026-10-01", periodEnd: "2026-10-29", loginSeconds: 150 * H });
    const out = applyLoginRule([periodo], [], 12 * H);
    expect(out.records[0].loginSeconds).toBe(150 * H);
    expect(out.alerts).toEqual([]);
  });

  it("só olha os dias pedidos (onlyKeys): dados antigos não são mexidos por uma importação nova", () => {
    const antigo = record({ id: 1, periodStart: "2026-10-26", periodEnd: "2026-10-26" });
    const novo = record({ id: 2, attendantId: 2, attendantName: "Agente Teste Dois", periodStart: "2026-10-27", periodEnd: "2026-10-27", loginSeconds: 20 * H });
    const out = applyLoginRule([antigo, novo], [], 12 * H, { onlyKeys: new Set(["2|2026-10-27"]) });
    expect(out.records[0].loginSeconds).toBe(18 * H + 11 * 60); // o antigo continua como estava
    expect(out.records[1].loginSeconds).toBeUndefined();
    expect(out.alerts.map((a) => a.attendantId)).toEqual([2]);
  });
});

describe("limite de login: sininho", () => {
  it("mostra abertos e vistos, esconde resolvidos, e usa a frase combinada", () => {
    const lista = buildLoginAlerts([
      alert({ id: 1, date: "2026-10-26", status: "open" }),
      alert({ id: 2, date: "2026-10-29", attendantName: "Agente Teste Dois", status: "seen", loginSeconds: 24 * H + 180 }),
      alert({ id: 3, date: "2026-10-17", status: "resolved" }),
    ]);
    expect(lista.map((a) => a.sharedAlertId)).toEqual([2, 1]); // mais recente primeiro; o resolvido sai
    expect(lista[0]).toMatchObject({
      message: LOGIN_ALERT_MESSAGE,
      kind: "login_excess",
      sharedStatus: "seen",
      attendantName: "Agente Teste Dois",
      alertLevel: "yellow",
    });
    expect(lista[0].message).toBe("Tempo logado desconsiderado — verificar se a pessoa deslogou");
    expect(lista[0].footer).toContain("29/10/2026");
    expect(lista[0].footer).toContain("24h03");
    expect(lista[1].sharedStatus).toBe("open");
    expect(lista.every((a) => a.id < 0)).toBe(true); // nunca colide com os alertas de meta
  });
});

describe("limite de login: importação", () => {
  const ana: Attendant = {
    id: 1,
    name: "Agente Teste Um",
    role: "Atendente",
    serviceChannel: "WhatsApp",
    workingHours: "08h00",
    jornadaStart: "",
    jornadaEnd: "",
    observation: "",
    registrationDate: "2026-01-01",
  };
  const row = (over: Partial<ProductivityRow> = {}): ProductivityRow => ({
    attendantName: "Agente Teste Um",
    date: "2026-10-26",
    inbound: 50,
    outbound: 2,
    total: 52,
    tmaSeconds: 170,
    loginSeconds: 18 * H,
    pauseSeconds: 3000,
    occupancy1: 60,
    perHour: 2.9,
    ...over,
  });
  const relatorio = (rows: ProductivityRow[], mode: ProductivityReport["mode"] = "daily"): ProductivityReport => ({
    title: "REL090",
    reportCode: "REL090",
    sheetName: "Sheet",
    channel: "WhatsApp",
    mode,
    rows,
    recognizedFields: [],
    warnings: [],
  });
  const opcoes = { channel: "WhatsApp" as const, createAttendants: false, fileName: "t.xls" };

  it("grava os atendimentos, esvazia o login e gera o alerta", () => {
    const out = executeProductivityImport(relatorio([row()]), [ana], [], [], opcoes);
    const r = out.productivityRecords[0];
    expect(r.attendancesCount).toBe(52);
    expect(r.loginSeconds).toBeUndefined();
    expect(r.pauseSeconds).toBeUndefined();
    expect(r.occupancyTo1).toBeUndefined();
    expect(r.perHour).toBeUndefined();
    expect(out.performanceRecords[0].attendancesCount).toBe(52); // o desempenho do dia segue normal
    expect(out.loginAlerts).toHaveLength(1);
    expect(out.loginAlerts[0]).toMatchObject({ attendantId: 1, date: "2026-10-26", loginSeconds: 18 * H, limitSeconds: 12 * H, status: "open" });
    expect(out.summary.loginDisregarded).toEqual([{ attendantName: "Agente Teste Um", date: "2026-10-26", loginSeconds: 18 * H }]);
    expect(out.logMessage).toContain("1 dia com tempo logado acima de 12 h desconsiderado");
  });

  it("login normal não gera alerta e fica como veio", () => {
    const out = executeProductivityImport(relatorio([row({ loginSeconds: 8 * H })]), [ana], [], [], opcoes);
    expect(out.productivityRecords[0].loginSeconds).toBe(8 * H);
    expect(out.loginAlerts).toEqual([]);
    expect(out.logMessage).not.toContain("desconsiderado");
  });

  it("o limite configurado vale, e limite null desliga a regra", () => {
    const comNove = executeProductivityImport(relatorio([row({ loginSeconds: 10 * H })]), [ana], [], [], { ...opcoes, loginLimitSeconds: 9 * H });
    expect(comNove.productivityRecords[0].loginSeconds).toBeUndefined();
    const desligada = executeProductivityImport(relatorio([row()]), [ana], [], [], { ...opcoes, loginLimitSeconds: null });
    expect(desligada.productivityRecords[0].loginSeconds).toBe(18 * H);
    expect(desligada.loginAlerts).toEqual([]);
  });

  it("o login do outro canal no mesmo dia também é esvaziado", () => {
    const ligacao = record({ id: 7, channel: "Ligação", loginSeconds: 18 * H });
    const out = executeProductivityImport(relatorio([row()]), [ana], [], [ligacao], opcoes);
    expect(out.productivityRecords.find((r) => r.channel === "Ligação")!.loginSeconds).toBeUndefined();
    expect(out.productivityRecords.find((r) => r.channel === "Ligação")!.attendancesCount).toBe(52);
  });

  it("reimportar o mesmo dia não duplica o alerta nem reabre um já resolvido", () => {
    const primeira = executeProductivityImport(relatorio([row()]), [ana], [], [], opcoes);
    const resolvido = primeira.loginAlerts.map((a) => ({ ...a, status: "resolved" as const }));
    const segunda = executeProductivityImport(relatorio([row()]), primeira.attendants, primeira.performanceRecords, primeira.productivityRecords, {
      ...opcoes,
      loginAlerts: resolvido,
    });
    expect(segunda.loginAlerts).toHaveLength(1);
    expect(segunda.loginAlerts[0].status).toBe("resolved");
  });

  it("relatório de período não passa pela regra", () => {
    const out = executeProductivityImport(relatorio([row({ date: undefined, loginSeconds: 150 * H })], "period"), [ana], [], [], {
      ...opcoes,
      periodStart: "2026-10-01",
      periodEnd: "2026-10-29",
    });
    expect(out.productivityRecords[0].loginSeconds).toBe(150 * H);
    expect(out.loginAlerts).toEqual([]);
  });
});
