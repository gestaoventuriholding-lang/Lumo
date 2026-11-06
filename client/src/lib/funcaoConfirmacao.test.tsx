import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FUNCAO_ATENDIMENTO, FUNCAO_CONFIRMACAO, isAtendimento, isConfirmacao, separarPorFuncao } from "./attendantRole";
import { buildAttendantSummaries, buildDashboardStats } from "./performanceMetrics";
import { buildOccupancyMap } from "./occupancyMap";
import { saveAttendants } from "./attendantsStorage";
import { resumoConfirmacao } from "@/components/ConfirmacaoAgendaCard";
import AttendantOccupancyMap from "@/components/AttendantOccupancyMap";
import { EllosDataProvider } from "@/contexts/EllosDataContext";
import Attendants from "@/pages/Attendants";
import type { Attendant } from "@/types/attendant";
import type { DailyPerformanceRecord } from "@/types/performance";
import type { ProductionGoal } from "@/types/goals";

// Todos os dados abaixo são inventados.
function pessoa(extra: Partial<Attendant> & Pick<Attendant, "id" | "name">): Attendant {
  return {
    role: FUNCAO_ATENDIMENTO, serviceChannel: "Ligação", workingHours: "6 horas", jornadaStart: "08:00", jornadaEnd: "14:00",
    observation: "", registrationDate: "2026-01-01", ...extra,
  };
}
function registro(id: number, attendantId: number, nome: string, canal: "Ligação" | "WhatsApp", atend: number, tma = 3): DailyPerformanceRecord {
  return {
    id, attendantId, attendantName: nome, date: "2026-11-03", channel: canal, attendancesCount: atend, averageTimeMinutes: tma,
    createdAt: "2026-11-03T12:00:00Z", updatedAt: "2026-11-03T12:00:00Z",
  } as DailyPerformanceRecord;
}
const metas: ProductionGoal[] = [
  { id: 1, channel: "Ligação", dailyTarget: 70, status: "Ativo", createdAt: "", updatedAt: "" },
  { id: 2, channel: "WhatsApp", dailyTarget: 75, status: "Ativo", createdAt: "", updatedAt: "" },
];
const dia = { start: "2026-11-03", end: "2026-11-03" } as never;

const ana = pessoa({ id: 1, name: "Ana Atende" });
const bia = pessoa({ id: 2, name: "Bia Atende", serviceChannel: "WhatsApp" });
const conf = pessoa({ id: 3, name: "Cora Confirma", role: FUNCAO_CONFIRMACAO, serviceChannel: "Ligação e WhatsApp" });
const todos = [ana, bia, conf];
const registros = [
  registro(1, 1, "Ana Atende", "Ligação", 70),
  registro(2, 2, "Bia Atende", "WhatsApp", 75),
  registro(3, 3, "Cora Confirma", "Ligação", 30, 1),
  registro(4, 3, "Cora Confirma", "WhatsApp", 5, 20),
];

describe("função: Atendimento x Confirmação de agenda", () => {
  it("quem não é de confirmação (inclui valor antigo ou vazio) conta como atendimento", () => {
    expect(isConfirmacao(conf)).toBe(true);
    expect(isAtendimento(ana)).toBe(true);
    expect(isAtendimento({ role: "" })).toBe(true);
  });

  it("separa colaboradores e registros por função", () => {
    const { atendimento, confirmacao } = separarPorFuncao(todos, registros);
    expect(atendimento.attendants.map((a) => a.id)).toEqual([1, 2]);
    expect(atendimento.records.map((r) => r.id)).toEqual([1, 2]);
    expect(confirmacao.attendants.map((a) => a.id)).toEqual([3]);
    expect(confirmacao.records.map((r) => r.id)).toEqual([3, 4]);
  });

  it("a confirmação some dos rankings (as duas listas e o geral)", () => {
    const { atendimento } = separarPorFuncao(todos, registros);
    const geral = buildAttendantSummaries(atendimento.records, atendimento.attendants, metas, dia);
    const voz = buildAttendantSummaries(atendimento.records, atendimento.attendants, metas, dia, "Ligação");
    const chat = buildAttendantSummaries(atendimento.records, atendimento.attendants, metas, dia, "WhatsApp");
    for (const lista of [geral, voz, chat]) expect(lista.some((s) => s.name === "Cora Confirma")).toBe(false);
    expect(geral.filter((s) => s.totalAttendances > 0).map((s) => s.name).sort()).toEqual(["Ana Atende", "Bia Atende"]);
  });

  it("as médias do atendimento não são puxadas por ela: com ela, o % de meta cai; sem ela, é 100%", () => {
    const { atendimento } = separarPorFuncao(todos, registros);
    const sem = buildDashboardStats(atendimento.attendants, atendimento.records, metas, dia);
    const com = buildDashboardStats(todos, registros, metas, dia);
    expect(sem.averagePercentage).toBeCloseTo(100, 5);
    expect(com.averagePercentage).toBeLessThan(sem.averagePercentage);
    expect(sem.totalAttendances).toBe(145); // 70 + 75, sem os 35 dela
    expect(sem.totalAttendants).toBe(2);
  });

  it("o cartão da confirmação soma só o dela, sem meta, com TMA ponderado", () => {
    const { confirmacao } = separarPorFuncao(todos, registros);
    const r = resumoConfirmacao(confirmacao.records, dia);
    expect(r.atendimentos).toBe(35);
    expect(r.tmaMinutos).toBeCloseTo((30 * 1 + 5 * 20) / 35, 5);
    expect(resumoConfirmacao(confirmacao.records, { start: "2026-12-01", end: "2026-12-02" }).atendimentos).toBe(0);
  });

  it("o mapa de ocupação mantém a confirmação, nos dois canais, com a função na linha", () => {
    const voz = buildOccupancyMap(todos, "Ligação");
    const chat = buildOccupancyMap(todos, "WhatsApp");
    expect(voz.rows.find((r) => r.name === "Cora Confirma")?.role).toBe(FUNCAO_CONFIRMACAO);
    expect(chat.rows.some((r) => r.name === "Cora Confirma")).toBe(true);
  });
});

describe("telas: função", () => {
  beforeAll(() => {
    const el = Element.prototype as unknown as Record<string, unknown>;
    el.hasPointerCapture ??= () => false;
    el.setPointerCapture ??= () => {};
    el.releasePointerCapture ??= () => {};
    el.scrollIntoView ??= () => {};
  });
  beforeEach(() => {
    window.localStorage.clear();
    saveAttendants(todos);
  });
  afterEach(() => cleanup());

  it("mapa de ocupação mostra o selo 'Confirmação' só para quem é de confirmação", () => {
    render(<AttendantOccupancyMap attendants={todos} />);
    expect(screen.getAllByTestId("selo-confirmacao").length).toBeGreaterThan(0);
    const linhaAna = screen.getAllByText("Ana Atende")[0].closest("div") as HTMLElement;
    expect(within(linhaAna).queryByTestId("selo-confirmacao")).toBeNull();
  });

  it("Atendentes: selo na lista, campo Função no cadastro e filtro por função", async () => {
    const user = userEvent.setup();
    render(
      <EllosDataProvider>
        <Attendants />
      </EllosDataProvider>
    );
    const tabela = () => within(screen.getByRole("table"));
    const linhaCora = tabela().getByText("Cora Confirma").closest("tr") as HTMLElement;
    expect(within(linhaCora).getByTestId("selo-confirmacao").textContent).toBe(FUNCAO_CONFIRMACAO);
    expect(within(tabela().getByText("Ana Atende").closest("tr") as HTMLElement).queryByTestId("selo-confirmacao")).toBeNull();

    await user.click(screen.getByTestId("filtro-funcao"));
    await user.click(await screen.findByRole("option", { name: FUNCAO_CONFIRMACAO }));
    expect(tabela().getByText("Cora Confirma")).toBeTruthy();
    expect(tabela().queryByText("Ana Atende")).toBeNull();

    await user.click(screen.getByRole("button", { name: /Novo Colaborador/i }));
    expect(within(screen.getByRole("dialog")).getByText("Função *")).toBeTruthy();
  });
});
