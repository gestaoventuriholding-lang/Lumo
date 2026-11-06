import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { montarPlanoDia, type ColaboradorSync } from "../../../supabase/functions/escallo-sync/plano";
import { sincronizar, type Deps } from "../../../supabase/functions/escallo-sync/sincronizar";
import type { RegistroEscallo } from "../../../supabase/functions/escallo-sync/mapeamento";
import { attendantsActiveOn, attendsChannel, desligadoEmTexto, isActiveOn, isTerminated } from "./attendantStatus";
import { buildOccupancyMap } from "./occupancyMap";
import { saveAttendants } from "./attendantsStorage";
import { applyImportChannelsToAttendants } from "./spreadsheetImport";
import { EllosDataProvider } from "@/contexts/EllosDataContext";
import Attendants from "@/pages/Attendants";
import type { Attendant } from "@/types/attendant";

// Todos os dados abaixo são inventados.
function pessoa(extra: Partial<Attendant> & Pick<Attendant, "id" | "name" | "serviceChannel">): Attendant {
  return {
    role: "Atendente", workingHours: "6 horas", jornadaStart: "08:00", jornadaEnd: "14:00", observation: "",
    registrationDate: "2026-01-01", ...extra,
  };
}

describe("colaborador desligado: datas", () => {
  const desligada = { terminatedOn: "2026-11-03" };
  it("o último dia trabalhado ainda vale; o dia seguinte não", () => {
    expect(isActiveOn(desligada, "2026-11-02")).toBe(true);
    expect(isActiveOn(desligada, "2026-11-03")).toBe(true);
    expect(isActiveOn(desligada, "2026-11-04")).toBe(false);
  });
  it("sem data = ativo em qualquer dia", () => {
    expect(isTerminated({ terminatedOn: null })).toBe(false);
    expect(isTerminated({})).toBe(false);
    expect(isActiveOn({ terminatedOn: null }, "2030-01-01")).toBe(true);
  });
  it("a lista de escolha de um dia some com quem já estava desligado", () => {
    const lista = [{ id: 1, terminatedOn: "2026-11-03" }, { id: 2, terminatedOn: null }, { id: 3, terminatedOn: "2026-10-01" }];
    expect(attendantsActiveOn(lista, "2026-11-03").map((a) => a.id)).toEqual([1, 2]);
    expect(attendantsActiveOn(lista, "2026-11-04").map((a) => a.id)).toEqual([2]);
  });
  it("selo mostra dia/mês", () => {
    expect(desligadoEmTexto("2026-11-03")).toBe("Desligado em 03/11");
  });
});

describe("canal Ligação e WhatsApp", () => {
  it("quem atende nos dois aparece nos dois canais; os outros só no seu", () => {
    expect(attendsChannel({ serviceChannel: "Ligação e WhatsApp" }, "Ligação")).toBe(true);
    expect(attendsChannel({ serviceChannel: "Ligação e WhatsApp" }, "WhatsApp")).toBe(true);
    expect(attendsChannel({ serviceChannel: "Ligação" }, "WhatsApp")).toBe(false);
    expect(attendsChannel({ serviceChannel: "WhatsApp" }, "Ligação")).toBe(false);
  });
  it("mapa de ocupação lista a pessoa dos dois canais em Ligação e em WhatsApp", () => {
    const todos = [
      pessoa({ id: 1, name: "Dupla", serviceChannel: "Ligação e WhatsApp" }),
      pessoa({ id: 2, name: "Só Voz", serviceChannel: "Ligação" }),
      pessoa({ id: 3, name: "Só Chat", serviceChannel: "WhatsApp" }),
    ];
    expect(buildOccupancyMap(todos, "Ligação").rows.map((r) => r.name).sort()).toEqual(["Dupla", "Só Voz"]);
    expect(buildOccupancyMap(todos, "WhatsApp").rows.map((r) => r.name).sort()).toEqual(["Dupla", "Só Chat"]);
  });
  it("planilha de um canal só não tira a pessoa de 'Ligação e WhatsApp'", () => {
    const todos = [
      pessoa({ id: 1, name: "Dupla", serviceChannel: "Ligação e WhatsApp" }),
      pessoa({ id: 2, name: "Troca", serviceChannel: "Ligação" }),
    ];
    const contagens = new Map([
      ["dupla", new Map([["WhatsApp" as const, 9]])],
      ["troca", new Map([["WhatsApp" as const, 9]])],
    ]);
    const depois = applyImportChannelsToAttendants(todos, contagens);
    expect(depois.find((a) => a.id === 1)?.serviceChannel).toBe("Ligação e WhatsApp");
    expect(depois.find((a) => a.id === 2)?.serviceChannel).toBe("WhatsApp"); // regra antiga continua para os demais
  });
});

describe("sincronização: colaborador desligado", () => {
  const DIA = "2026-11-04";
  const colaboradores: ColaboradorSync[] = [
    { id: 1, name: "Ativa", escallo_codigo: 101, terminated_on: null },
    { id: 2, name: "Saiu antes", escallo_codigo: 102, terminated_on: "2026-11-03" },
    { id: 3, name: "Sai hoje", escallo_codigo: 103, terminated_on: "2026-11-04" },
    { id: 4, name: "Sai depois", escallo_codigo: 104, terminated_on: "2026-12-01" },
  ];
  const voz = (codigo: number, extra: RegistroEscallo = {}): RegistroEscallo => ({
    codigo, nome: `Agente ${codigo}`, ligacoesOferecidasAtendidas: 10, ligacoesRealizadasAtendidas: 2, tempoAtendimento: 1500,
    tempoRealizadas: 300, TMA: 150, tempoLogin: 28_800, tempoPausa: 3_000, pausaLegal: 2_000, pausaProdutiva: 400, pausaImprodutiva: 600,
    percentualPausa: 10.4, TO01: 60, TO02: 62, TO03: 0, TO04: 0, chamadasPorHora: 4.5, ...extra,
  });
  const chat = (codigo: number, extra: RegistroEscallo = {}): RegistroEscallo => ({
    codigo, nome: `Agente ${codigo}`, atendimentosEntrada: 20, atendimentosSaida: 5, atendimentosTempo: 4000, TMA: 180, login: 28_800,
    pausa: 3_000, percentualPausa: 10.4, pausaLegal: 2_000, pausaProdutiva: 400, pausaImprodutiva: 600, TO01: 70, TO02: 71, atendimentoHora: 3.2, ...extra,
  });
  const montar = (rel025: RegistroEscallo[], rel090: RegistroEscallo[], dia = DIA) =>
    montarPlanoDia({ dia, rel025, rel090, colaboradores, limiteLoginSegundos: 43_200 });

  it("depois do último dia trabalhado nada é gravado, em nenhum canal, e vira aviso", () => {
    const p = montar([voz(101), voz(102)], [chat(101), chat(102)]);
    expect(p.linhas.map((l) => `${l.attendant_id}:${l.channel}`).sort()).toEqual(["1:Ligação", "1:WhatsApp"]);
    expect(p.avisos).toHaveLength(2);
    expect(p.avisos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tipo: "desligado", colaborador_id: 2, nome: "Saiu antes", dia: DIA, canal: "Ligação", atendimentos: 12, terminated_on: "2026-11-03" }),
        expect.objectContaining({ colaborador_id: 2, canal: "WhatsApp", atendimentos: 25 }),
      ])
    );
    expect(p.resumo.ignoradosDesligados).toBe(2);
    expect(p.resumo.semVinculoComAtendimento).toBe(0); // desligado cadastrado não é "sem vínculo"
  });

  it("no último dia trabalhado os dados ainda são gravados, sem aviso", () => {
    const p = montar([voz(103)], [chat(103)]);
    expect(p.linhas).toHaveLength(2);
    expect(p.avisos).toEqual([]);
  });

  it("desligamento futuro não muda nada hoje", () => {
    const p = montar([voz(104)], [chat(104)]);
    expect(p.linhas).toHaveLength(2);
    expect(p.avisos).toEqual([]);
  });

  it("dias antes da data de desligamento continuam como estão", () => {
    const p = montar([voz(102)], [chat(102)], "2026-11-03");
    expect(p.linhas).toHaveLength(2);
    expect(p.avisos).toEqual([]);
  });

  it("desligado sem atendimento no dia não gera aviso nem linha", () => {
    const zerado = voz(102, { ligacoesOferecidasAtendidas: 0, ligacoesRealizadasAtendidas: 0 });
    const p = montar([zerado], [chat(102, { atendimentosEntrada: 0, atendimentosSaida: 0 })]);
    expect(p.linhas).toEqual([]);
    expect(p.avisos).toEqual([]);
  });

  it("login de desligado, depois da data, não gera alerta de tempo logado", () => {
    const p = montar([voz(102, { tempoLogin: 90_000 })], [chat(102, { login: 90_000 })]);
    expect(p.alertas).toEqual([]);
    expect(p.linhas).toEqual([]);
  });

  it("quem não está cadastrado (como antes) segue ignorado e contado como sem vínculo", () => {
    const p = montar([voz(999)], [chat(999)]);
    expect(p.linhas).toEqual([]);
    expect(p.avisos).toEqual([]);
    expect(p.resumo.semVinculoComAtendimento).toBe(2);
  });

  it("a execução soma os avisos de todos os dias e entrega ao registro", async () => {
    const gravados: string[] = [];
    const d: Deps = {
      async buscarRelatorio(rel) { return rel === "rel025" ? [voz(101), voz(102)] : [chat(102)]; },
      async lerColaboradores() { return colaboradores; },
      async lerLimiteLogin() { return 43_200; },
      async aplicarDia(plano) { gravados.push(plano.dia); return { inseridas: plano.linhas.length, atualizadas: 0, puladas_manuais: 0, alertas_novos: 0 }; },
      async esperar() {},
    };
    const r = await sincronizar(d, { modo: "manual", dias: ["2026-11-04", "2026-11-05"] }, "2026-11-06");
    expect(r.totais.ignoradosDesligados).toBe(4); // 2 dias x (ligação + WhatsApp) da pessoa 102
    expect(r.avisos.length).toBe(r.totais.ignoradosDesligados);
    expect(gravados).toEqual(["2026-11-04", "2026-11-05"]);
  });
});

describe("tela de Atendentes: desligado", () => {
  beforeAll(() => {
    // o Select do Radix usa funções que o jsdom não tem
    const el = Element.prototype as unknown as Record<string, unknown>;
    el.hasPointerCapture ??= () => false;
    el.setPointerCapture ??= () => {};
    el.releasePointerCapture ??= () => {};
    el.scrollIntoView ??= () => {};
  });
  beforeEach(() => {
    window.localStorage.clear();
    saveAttendants([
      pessoa({ id: 1, name: "Ana Ativa", serviceChannel: "Ligação e WhatsApp" }),
      pessoa({ id: 2, name: "Bia Desligada", serviceChannel: "WhatsApp", terminatedOn: "2026-10-15" }),
    ]);
  });
  afterEach(() => cleanup());

  const abrir = () =>
    render(
      <EllosDataProvider>
        <Attendants />
      </EllosDataProvider>
    );

  it("lista só ativos por padrão e o filtro mostra os desligados com o selo 'Desligado em dd/mm'", async () => {
    const user = userEvent.setup();
    abrir();
    const tabela = () => within(screen.getByRole("table"));
    expect(tabela().getByText("Ana Ativa")).toBeTruthy();
    expect(tabela().queryByText("Bia Desligada")).toBeNull();
    expect(tabela().getByText("Ligação e WhatsApp")).toBeTruthy();

    await user.click(screen.getByTestId("filtro-situacao"));
    await user.click(await screen.findByRole("option", { name: "Desligados" }));
    expect(tabela().queryByText("Ana Ativa")).toBeNull();
    const linha = tabela().getByText("Bia Desligada").closest("tr") as HTMLElement;
    expect(within(linha).getByTestId("selo-desligado").textContent).toBe("Desligado em 15/10");

    await user.click(screen.getByTestId("filtro-situacao"));
    await user.click(await screen.findByRole("option", { name: "Todos" }));
    expect(tabela().getByText("Ana Ativa")).toBeTruthy();
    expect(tabela().getByText("Bia Desligada")).toBeTruthy();
  });

  it("no cadastro, 'Desligado' pede a data e mostra o texto de ajuda 'Último dia trabalhado'", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole("button", { name: /Novo Colaborador/i }));
    expect(screen.queryByText("Último dia trabalhado")).toBeNull();
    await user.click(screen.getByRole("checkbox", { name: "Desligado" }));
    expect(screen.getByText("Último dia trabalhado")).toBeTruthy();
    expect(screen.getByLabelText(/Data de desligamento/)).toBeTruthy();
  });
});
