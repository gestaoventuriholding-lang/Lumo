import { describe, expect, it } from "vitest";
import {
  converterRegistro,
  ligarColaboradores,
  numero,
  totaisDoPreview,
  validarPedido,
  type Colaborador,
  type RegistroEscallo,
} from "../../../supabase/functions/escallo-rel025/mapeamento";

// Todos os dados abaixo são inventados.
function registro(extra: RegistroEscallo = {}): RegistroEscallo {
  return {
    codigo: 101,
    nome: "Agente Teste Um",
    tipoAgente: "Usuário",
    agenteChaveExterna: "",
    ligacoesOferecidas: 12,
    ligacoesOferecidasAtendidas: 10,
    ligacoesRealizadas: 5,
    ligacoesRealizadasAtendidas: 4,
    tempoAtendimento: 1200,
    tempoRealizadas: 300,
    TMA: 120.4,
    TML: 75,
    tempoLogin: 28800,
    tempoPausa: 3600,
    pausaLegal: 2000,
    pausaProdutiva: 600,
    pausaImprodutiva: 1000,
    percentualPausa: 12.5,
    percentualOferecidasAtendidas: 83.33,
    percentualRealizadas: 80,
    TO01: 40.126,
    TO02: 45,
    TO03: 0,
    TO04: 0,
    chamadasPorHora: "1,75",
    ...extra,
  };
}

const colaboradores: Colaborador[] = [
  { id: 1, name: "Agente Teste Um", escallo_codigo: 101 },
  { id: 2, name: "Ágente  Teste Dois", escallo_codigo: null },
  { id: 3, name: "Agente Teste Três", escallo_codigo: 999 },
  { id: 4, name: "Agente Repetido", escallo_codigo: null },
  { id: 5, name: "agente repetido", escallo_codigo: null },
];

describe("escallo rel025: pedido", () => {
  const hoje = "2026-11-05";
  it("aceita um dia válido e usa 1 como padrão de exibirUsuarioSistema", () => {
    expect(validarPedido({ dia: "2026-11-03" }, hoje)).toEqual({ pedido: { dia: "2026-11-03", exibirUsuarioSistema: "1" } });
    expect(validarPedido({ dia: "2026-11-03", exibirUsuarioSistema: "0" }, hoje)).toEqual({
      pedido: { dia: "2026-11-03", exibirUsuarioSistema: "0" },
    });
  });
  it("recusa data fora do formato, inexistente ou futura", () => {
    expect(validarPedido({ dia: "03/11/2026" }, hoje)).toHaveProperty("erro");
    expect(validarPedido({ dia: "2026-02-31" }, hoje)).toHaveProperty("erro");
    expect(validarPedido({ dia: "2026-11-06" }, hoje)).toHaveProperty("erro");
    expect(validarPedido({}, hoje)).toHaveProperty("erro");
  });
  it("recusa campos extras (período, agente) e valores estranhos", () => {
    expect(validarPedido({ dia: "2026-11-03", dataFinal: "2026-11-04" }, hoje)).toHaveProperty("erro");
    expect(validarPedido({ dia: "2026-11-03", agente: "x" }, hoje)).toHaveProperty("erro");
    expect(validarPedido({ dia: "2026-11-03", exibirUsuarioSistema: "2" }, hoje)).toHaveProperty("erro");
    expect(validarPedido("2026-11-03", hoje)).toHaveProperty("erro");
  });
});

describe("escallo rel025: números", () => {
  it("troca a vírgula por ponto e recusa lixo", () => {
    expect(numero("1,75")).toBe(1.75);
    expect(numero("1.234,5")).toBe(1234.5);
    expect(numero(7)).toBe(7);
    expect(numero("abc")).toBeNull();
    expect(numero("")).toBeNull();
    expect(numero(null)).toBeNull();
    expect(numero(NaN)).toBeNull();
  });
});

describe("escallo rel025: conversão de um registro", () => {
  it("mapeia os campos para as colunas do Ellos", () => {
    const { dados, problemas } = converterRegistro(registro(), "2026-11-03");
    expect(problemas).toEqual([]);
    const p = dados!.produtividade;
    expect(p).toMatchObject({
      period_start: "2026-11-03",
      period_end: "2026-11-03",
      channel: "Ligação",
      inbound_count: 10,
      outbound_count: 4,
      attendances_count: 14, // entrada + saída atendidas
      talk_seconds: 1500, // tempoAtendimento + tempoRealizadas
      tma_seconds: 120, // arredondado
      login_seconds: 28800,
      pause_seconds: 3600,
      pause_legal_seconds: 2000,
      pause_productive_seconds: 600,
      pause_unproductive_seconds: 1000,
      pause_percent: 12.5,
      occupancy_to1: 40.13,
      occupancy_to2: 45,
      per_hour: 1.75, // vinha como texto com vírgula
      report_code: "REL025",
      source_file: "API Escallo",
    });
    expect(dados!.diario).toEqual({ date: "2026-11-03", channel: "Ligação", attendances_count: 14, average_time_minutes: 2.01 });
  });

  it("deixa TO3 e TO4 vazios quando vêm 0, e mantém quando têm valor", () => {
    expect(converterRegistro(registro(), "2026-11-03").dados!.produtividade).toMatchObject({
      occupancy_to3: null,
      occupancy_to4: null,
    });
    expect(converterRegistro(registro({ TO03: 33.333, TO04: 20 }), "2026-11-03").dados!.produtividade).toMatchObject({
      occupancy_to3: 33.33,
      occupancy_to4: 20,
    });
  });

  it("login acima de 12 h: grava os atendimentos e esvazia login, pausa, ocupação e chamadas por hora", () => {
    const r = converterRegistro(registro({ tempoLogin: 65459, TO03: 33.333, TO04: 20 }), "2026-11-03");
    expect(r.problemas).toEqual([]);
    expect(r.loginDesconsiderado).toEqual({ loginSegundos: 65459, limiteSegundos: 43200 });
    const p = r.dados!.produtividade;
    expect(p).toMatchObject({
      inbound_count: 10,
      outbound_count: 4,
      attendances_count: 14, // atendimentos ficam
      talk_seconds: 1500, // tempo de conversa fica
      tma_seconds: 120, // TMA fica
      login_seconds: null,
      pause_seconds: null,
      pause_percent: null,
      pause_legal_seconds: null,
      pause_productive_seconds: null,
      pause_unproductive_seconds: null,
      occupancy_to1: null,
      occupancy_to2: null,
      occupancy_to3: null,
      occupancy_to4: null,
      per_hour: null,
    });
    expect(r.dados!.diario.attendances_count).toBe(14);
  });

  it("o limite de login é configurável: no limite exato não esvazia, acima esvazia, e null desliga a regra", () => {
    expect(converterRegistro(registro({ tempoLogin: 43200 }), "2026-11-03").loginDesconsiderado).toBeNull();
    expect(converterRegistro(registro({ tempoLogin: 43201 }), "2026-11-03").loginDesconsiderado).not.toBeNull();
    expect(converterRegistro(registro({ tempoLogin: 36000 }), "2026-11-03", 32400).loginDesconsiderado).toEqual({
      loginSegundos: 36000,
      limiteSegundos: 32400,
    });
    const desligada = converterRegistro(registro({ tempoLogin: 86593 }), "2026-11-03", null);
    expect(desligada.loginDesconsiderado).toBeNull();
    expect(desligada.dados!.produtividade.login_seconds).toBe(86593);
  });

  it("manda para revisão: campo faltando e número negativo", () => {
    const semCampo = registro();
    delete semCampo.TMA;
    expect(converterRegistro(semCampo, "2026-11-03").problemas[0]).toMatch(/TMA/);
    expect(converterRegistro(registro({ tempoPausa: -1 }), "2026-11-03").problemas[0]).toMatch(/negativo/);
  });
});

describe("escallo rel025: ligação com os colaboradores", () => {
  it("liga só pelo código", () => {
    const { vinculados, sobras } = ligarColaboradores([registro()], colaboradores, "2026-11-03");
    expect(vinculados).toHaveLength(1);
    expect(vinculados[0]).toMatchObject({ attendantId: 1, escalloCodigo: 101 });
    expect(sobras).toEqual([]);
  });

  it("não liga pelo nome: quem tem nome igual mas código diferente fica de fora, sem criar ninguém", () => {
    const { vinculados, sobras } = ligarColaboradores(
      [registro({ codigo: 202, nome: "agente teste dois" })],
      colaboradores,
      "2026-11-03"
    );
    expect(vinculados).toHaveLength(0);
    expect(sobras).toHaveLength(1);
    expect(sobras[0]).toMatchObject({ codigo: 202, motivo: "sem_vinculo", sugestao: { id: 2 } });
  });

  it("não sugere quando o nome é ambíguo ou o colaborador já tem outro código", () => {
    const { sobras } = ligarColaboradores(
      [registro({ codigo: 303, nome: "Agente Repetido" }), registro({ codigo: 404, nome: "Agente Teste Três" })],
      colaboradores,
      "2026-11-03"
    );
    expect(sobras.map((s) => s.sugestao)).toEqual([null, null]);
  });

  it("registro sem colaborador e sem nome parecido fica sem sugestão", () => {
    const { sobras } = ligarColaboradores([registro({ codigo: 505, nome: "Fulano Desconhecido" })], colaboradores, "2026-11-03");
    expect(sobras[0]).toMatchObject({ motivo: "sem_vinculo", sugestao: null });
  });

  it("manda para revisão (e não grava) o registro sem código e o repetido", () => {
    const { vinculados, sobras } = ligarColaboradores(
      [
        registro({ codigo: null, nome: "Sem Codigo" }),
        registro({ codigo: 7, nome: "Repetido A" }),
        registro({ codigo: 7, nome: "Repetido B" }),
      ],
      colaboradores,
      "2026-11-03"
    );
    expect(vinculados).toHaveLength(0);
    expect(sobras.map((s) => s.motivo)).toEqual(["revisar", "sem_vinculo", "revisar"]);
  });

  it("login acima do limite continua vinculado e gravável (com login vazio e marcado para o alerta)", () => {
    const { vinculados, sobras } = ligarColaboradores([registro({ tempoLogin: 90000 })], colaboradores, "2026-11-03");
    expect(sobras).toEqual([]);
    expect(vinculados).toHaveLength(1);
    expect(vinculados[0].produtividade.login_seconds).toBeNull();
    expect(vinculados[0].produtividade.attendances_count).toBe(14);
    expect(vinculados[0].loginDesconsiderado).toEqual({ loginSegundos: 90000, limiteSegundos: 43200 });
    // com a regra desligada, grava o login como veio
    const semRegra = ligarColaboradores([registro({ tempoLogin: 90000 })], colaboradores, "2026-11-03", null);
    expect(semRegra.vinculados[0].produtividade.login_seconds).toBe(90000);
    expect(semRegra.vinculados[0].loginDesconsiderado).toBeNull();
  });

  it("os totais do preview somam só os registros ligados", () => {
    const { vinculados } = ligarColaboradores(
      [registro(), registro({ codigo: 202, nome: "Outro" })],
      colaboradores,
      "2026-11-03"
    );
    expect(totaisDoPreview(vinculados)).toEqual({
      atendimentos: 14,
      entrada: 10,
      saida: 4,
      loginSegundos: 28800,
      pausaSegundos: 3600,
      comLoginDesconsiderado: 0,
    });
  });
});
