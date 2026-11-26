import { describe, expect, it } from "vitest";
import { areaDaFila, classificarFila, filasNaoReconhecidas, paraTabela, resumirLigacoes, resumirWhatsapp } from "../../../supabase/functions/escallo-sync/filas";
import { iaParaTabela, lerRel103Completo, resumirConsumoIA } from "../../../supabase/functions/escallo-sync/ia";
import { sincronizar, type Deps } from "../../../supabase/functions/escallo-sync/sincronizar";
import type { RegistroEscallo } from "../../../supabase/functions/escallo-sync/mapeamento";

// Todos os dados abaixo são inventados.
const chamada = (fila: string, status: "Atendida" | "Abandonada pelo chamador", espera: number): RegistroEscallo => ({
  "telefoniaFilaAtendimento.nome": fila,
  "filaAtendimentoLigacao.statusFormatado": status,
  "filaAtendimentoLigacao.status": status === "Atendida" ? 1 : 2,
  "filaAtendimentoLigacao.tempoEspera": espera,
});

describe("filas: grupo de cada fila (3 opções da URA + Outras)", () => {
  it("laboratoriais, imagem, cardiológicos e outras, como aprovado", () => {
    for (const f of ["Preparo AC", "Resultados AC", "Coleta Domiciliar", "Transbordo Coleta domiciliar"]) expect(areaDaFila(f)).toBe("analises");
    for (const f of ["USG", "RM", "TC", "MMG / DEO / RX", "Resultados DI"]) expect(areaDaFila(f)).toBe("imagem");
    expect(areaDaFila("Exames Cardiologicos")).toBe("cardiologicos");
    expect(areaDaFila("Exames Cardiológicos")).toBe("cardiologicos");
    for (const f of ["Orçamento", "Falar com Atendente", "Entrega de Laudos", "Clínicas parceiras"]) expect(areaDaFila(f)).toBe("outros");
  });

  it("'Recuperação Automática - X' segue o grupo de X", () => {
    expect(areaDaFila("Recuperação Automática - RM")).toBe("imagem");
    expect(areaDaFila("Recuperação Automática - Preparo AC")).toBe("analises");
    expect(areaDaFila("Recuperação Automática - Coleta Domiciliar")).toBe("analises");
    expect(areaDaFila("Recuperação Automática - Orçamento")).toBe("outros");
    expect(areaDaFila("  usg ")).toBe("imagem");
  });

  it("fila nova (mesmo terminada em AC ou DI) vai para Outras e não conta como reconhecida", () => {
    for (const f of ["Fila Nova", "Agendamento DI", "Agendamento AC", "", null]) {
      expect(classificarFila(f)).toEqual({ area: "outros", reconhecida: false });
    }
    expect(classificarFila("Orçamento")).toEqual({ area: "outros", reconhecida: true });
  });

  it("filasNaoReconhecidas lista cada nome uma vez e ignora filas conhecidas e chamadas sem situação", () => {
    const lista = filasNaoReconhecidas([
      chamada("Fila Nova", "Atendida", 5), chamada("Fila Nova", "Abandonada pelo chamador", 5), chamada("USG", "Atendida", 5),
      chamada("Entrega de Laudos", "Atendida", 5), chamada("Outra Nova", "Atendida", 1),
      { "telefoniaFilaAtendimento.nome": "Sem Situacao", "filaAtendimentoLigacao.statusFormatado": "Outra coisa" },
    ]);
    expect(lista.sort()).toEqual(["Fila Nova", "Outra Nova"]);
  });

  it("a soma dos 4 grupos fecha com o total de atendidas e de abandonadas", () => {
    const regs = [
      chamada("Preparo AC", "Atendida", 1), chamada("USG", "Atendida", 1), chamada("USG", "Abandonada pelo chamador", 1),
      chamada("Exames Cardiologicos", "Atendida", 1), chamada("Orçamento", "Atendida", 1), chamada("Entrega de Laudos", "Abandonada pelo chamador", 1),
      chamada("Fila Nova", "Atendida", 1), chamada("Recuperação Automática - TC", "Atendida", 1),
    ];
    const linhas = resumirLigacoes("2026-11-16", regs);
    expect(linhas.reduce((n, l) => n + l.atendidas, 0)).toBe(6);
    expect(linhas.reduce((n, l) => n + l.abandonadas, 0)).toBe(2);
    expect(linhas.find((l) => l.area === "cardiologicos")?.atendidas).toBe(1);
    expect(linhas.find((l) => l.area === "outros")).toMatchObject({ atendidas: 2, abandonadas: 1 });
  });
});

describe("filas: ligação (rel001)", () => {
  const linhas = resumirLigacoes("2026-11-16", [
    chamada("USG", "Atendida", 10), chamada("USG", "Atendida", 30), chamada("USG", "Abandonada pelo chamador", 99),
    chamada("Preparo AC", "Atendida", 20), chamada("Orçamento", "Abandonada pelo chamador", 5),
    { "telefoniaFilaAtendimento.nome": "USG", "filaAtendimentoLigacao.statusFormatado": "Outra coisa" },
  ]);
  const por = (a: string) => linhas.find((l) => l.area === a);

  it("conta atendidas e abandonadas por área e soma a espera só das atendidas", () => {
    expect(por("imagem")).toMatchObject({ canal: "Ligação", atendidas: 2, abandonadas: 1, espera_total_segundos: 40 });
    expect(por("analises")).toMatchObject({ atendidas: 1, abandonadas: 0, espera_total_segundos: 20 });
    expect(por("outros")).toMatchObject({ atendidas: 0, abandonadas: 1, espera_total_segundos: 0 });
  });

  it("dia sem chamadas não gera linha", () => {
    expect(resumirLigacoes("2026-11-16", [])).toEqual([]);
  });
});

describe("filas: WhatsApp (rel091)", () => {
  it("TME do dia = média ponderada pelos atendimentos de cada hora; ignora a linha Média e horas vazias", () => {
    const linhas = resumirWhatsapp("2026-11-16", [
      { hora: "06:00:00", atendimentos: 10, TMA: 100, TMEAT: 100 },
      { hora: "07:00:00", atendimentos: 30, TMA: 100, TMEAT: 200 },
      { hora: "08:00:00", atendimentos: 0, TMA: 0, TMEAT: 0 },
      { hora: "Média", atendimentos: 20, TMA: 100, TMEAT: 9999 },
    ]);
    expect(linhas).toEqual([{ dia: "2026-11-16", canal: "WhatsApp", area: "total", atendidas: 40, abandonadas: 0, espera_total_segundos: 10 * 100 + 30 * 200 }]);
  });

  it("a linha Média da Escallo vem com hora repetida (ex.: 21:00:00): não conta como uma hora a mais", () => {
    const horas = Array.from({ length: 24 }, (_, h) => ({
      hora: `${String(h).padStart(2, "0")}:00:00`,
      atendimentos: h === 7 ? 40 : h === 9 ? 60 : 0,
      TMEAT: h === 7 ? 100 : h === 9 ? 200 : 0,
    }));
    const [linha] = resumirWhatsapp("2026-11-16", [...horas, { hora: "21:00:00", atendimentos: 50, TMEAT: 9999 }]);
    expect(linha.atendidas).toBe(100);
    expect(linha.espera_total_segundos).toBe(40 * 100 + 60 * 200);
  });

  it("sem atendimentos não gera linha", () => {
    expect(resumirWhatsapp("2026-11-16", [{ hora: "06:00:00", atendimentos: 0, TMEAT: 0 }])).toEqual([]);
  });

  it("formato da tabela, sem telefone nem protocolo", () => {
    const t = paraTabela([{ dia: "2026-11-16", canal: "Ligação", area: "imagem", atendidas: 2, abandonadas: 1, espera_total_segundos: 40 }]);
    expect(t).toEqual([{ date: "2026-11-16", channel: "Ligação", area: "imagem", answered: 2, abandoned: 1, wait_seconds_total: 40 }]);
  });
});

describe("filas: dentro da sincronização", () => {
  function deps(extra: Partial<Deps> = {}) {
    const gravadas: number[] = [];
    const d: Deps = {
      async buscarRelatorio() { return []; },
      async lerColaboradores() { return []; },
      async lerLimiteLogin() { return 43_200; },
      async aplicarDia(plano) { return { inseridas: plano.linhas.length, atualizadas: 0, puladas_manuais: 0, alertas_novos: 0 }; },
      async esperar() {},
      async buscarFilas(dia) { return { linhas: [{ dia, canal: "WhatsApp", area: "total", atendidas: 1, abandonadas: 0, espera_total_segundos: 5 }] }; },
      async gravarFilas(l) { gravadas.push(l.length); },
      ...extra,
    };
    return { d, gravadas };
  }

  it("grava as filas junto com o dia; na simulação não grava", async () => {
    const a = deps();
    const r = await sincronizar(a.d, { modo: "hoje" }, "2026-11-05");
    expect(a.gravadas).toEqual([1]);
    expect(r.filas).toEqual({ linhas: 1, erros: [], avisos: [] });
    const b = deps();
    await sincronizar(b.d, { modo: "simulacao", dias: ["2026-11-03"] }, "2026-11-05");
    expect(b.gravadas).toEqual([]);
  });

  it("no fechamento, relê as filas dos 7 dias (sem domingo); nos outros modos, só o próprio dia", async () => {
    const lidos: string[] = [];
    const registrar = async (dia: string) => { lidos.push(dia); return { linhas: [] }; };
    // 26/11/2026 é quinta: fecha o dia 25 e relê de 19 a 24, pulando o domingo 22
    await sincronizar(deps({ buscarFilas: registrar }).d, { modo: "fechamento" }, "2026-11-26");
    expect(lidos).toEqual(["2026-11-25", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-23", "2026-11-24"]);
    lidos.length = 0;
    await sincronizar(deps({ buscarFilas: registrar }).d, { modo: "hoje" }, "2026-11-26");
    expect(lidos).toEqual(["2026-11-26"]);
  });

  it("se um dia da releitura falhar, os outros seguem e o erro fica anotado", async () => {
    const { d, gravadas } = deps();
    const original = d.buscarFilas!;
    d.buscarFilas = async (dia) => { if (dia === "2026-11-20") throw new Error("rel091 fora do ar"); return original(dia); };
    const r = await sincronizar(d, { modo: "fechamento" }, "2026-11-26");
    expect(gravadas).toHaveLength(5);
    expect(r.filas.erros).toEqual(["2026-11-20: rel091 fora do ar"]);
    expect(r.dias).toEqual(["2026-11-25"]);
  });

  it("se as filas falharem, o dia principal continua gravado e o erro fica anotado", async () => {
    const { d } = deps({ async buscarFilas() { throw new Error("rel001 fora do ar"); } });
    const r = await sincronizar(d, { modo: "hoje" }, "2026-11-05");
    expect(r.gravou).toBe(true);
    expect(r.filas.linhas).toBe(0);
    expect(r.filas.erros[0]).toContain("rel001 fora do ar");
  });

  it("fila nova sem grupo: o aviso vai para a lista de avisos da corrida, sem repetir", async () => {
    const { d } = deps({ async buscarFilas(dia) { return { linhas: [], avisos: [{ tipo: "fila_nova", fila: "Fila Nova", dia, mensagem: "x" }, { tipo: "fila_nova", fila: "Fila Nova", dia, mensagem: "x" }] }; } });
    const r = await sincronizar(d, { modo: "hoje" }, "2026-11-05");
    expect(r.filas.avisos).toEqual([{ tipo: "fila_nova", fila: "Fila Nova", dia: "2026-11-05", mensagem: "x" }]);
    expect(r.avisos).toContainEqual({ tipo: "fila_nova", fila: "Fila Nova", dia: "2026-11-05", mensagem: "x" });
  });

  it("sem as funções de fila (como antes) tudo funciona igual", async () => {
    const { d } = deps({ buscarFilas: undefined, gravarFilas: undefined });
    const r = await sincronizar(d, { modo: "hoje" }, "2026-11-05");
    expect(r.filas).toEqual({ linhas: 0, erros: [], avisos: [] });
  });
});

describe("consumo de FTokens da IA (rel103)", () => {
  // Dados inventados.
  const acao = (protocolo: string, ftokens: number | string): RegistroEscallo => ({ protocolo, fTokensAcao: ftokens, acao: "analise_intencao" });

  it("soma os FTokens das ações e conta contatos (protocolos) distintos", () => {
    const c = resumirConsumoIA("2026-11-03", [acao("A1", 0.02), acao("A1", 0.02), acao("B2", 0.02), acao("C3", 10.5)]);
    expect(c).toEqual({ dia: "2026-11-03", ftokens: 10.56, contatos: 3, acoes: 4 });
  });

  it("aceita número em texto com vírgula, ignora valor negativo; dia sem ações não gera linha", () => {
    expect(resumirConsumoIA("2026-11-03", [acao("A1", "0,5"), acao("A2", -3)])).toMatchObject({ ftokens: 0.5, contatos: 2, acoes: 2 });
    expect(resumirConsumoIA("2026-11-03", [])).toBeNull();
  });

  it("soma sem erro de ponto flutuante (arredonda a 2 casas)", () => {
    const muitas = Array.from({ length: 300 }, (_, i) => acao(`P${i}`, 0.02));
    expect(resumirConsumoIA("2026-11-03", muitas)!.ftokens).toBe(6);
  });

  it("formato da tabela, sem telefone nem protocolo", () => {
    expect(iaParaTabela({ dia: "2026-11-03", ftokens: 10.56, contatos: 3, acoes: 4 })).toEqual({ date: "2026-11-03", ftokens: 10.56, contacts: 3, actions: 4 });
  });

  function deps(extra: Partial<Deps> = {}) {
    const gravados: string[] = [];
    const d: Deps = {
      async buscarRelatorio() { return []; },
      async lerColaboradores() { return []; },
      async lerLimiteLogin() { return 43_200; },
      async aplicarDia(plano) { return { inseridas: plano.linhas.length, atualizadas: 0, puladas_manuais: 0, alertas_novos: 0 }; },
      async esperar() {},
      async buscarIA(dia) { return { dia, ftokens: 5, contatos: 3, acoes: 4 }; },
      async gravarIA(c) { gravados.push(c.dia); },
      ...extra,
    };
    return { d, gravados };
  }

  it("grava junto com o dia; na simulação não grava", async () => {
    const a = deps();
    const r = await sincronizar(a.d, { modo: "hoje" }, "2026-11-05");
    expect(a.gravados).toEqual(["2026-11-05"]);
    expect(r.ia).toEqual({ dias: 1, erros: [] });
    const b = deps();
    await sincronizar(b.d, { modo: "simulacao", dias: ["2026-11-03"] }, "2026-11-05");
    expect(b.gravados).toEqual([]);
  });

  it("se o consumo de IA falhar, o dia principal continua gravado e o erro fica anotado", async () => {
    const { d } = deps({ async buscarIA() { throw new Error("rel103 fora do ar"); } });
    const r = await sincronizar(d, { modo: "hoje" }, "2026-11-05");
    expect(r.gravou).toBe(true);
    expect(r.ia.dias).toBe(0);
    expect(r.ia.erros[0]).toContain("rel103 fora do ar");
  });

  it("dia sem consumo (a IA parou) não grava linha e não é erro", async () => {
    const a = deps({ async buscarIA() { return null; } });
    const r = await sincronizar(a.d, { modo: "hoje" }, "2026-11-16");
    expect(a.gravados).toEqual([]);
    expect(r.ia).toEqual({ dias: 0, erros: [] });
  });

  it("sem as funções de IA (como antes) tudo funciona igual", async () => {
    const { d } = deps({ buscarIA: undefined, gravarIA: undefined });
    const r = await sincronizar(d, { modo: "hoje" }, "2026-11-05");
    expect(r.ia).toEqual({ dias: 0, erros: [] });
  });
});

describe("consumo de IA: leitura paginada do rel103", () => {
  // Dados inventados. A linha é identificada por data|protocolo|acao|fTokensAcao|dataHoraInicial.
  const linhas = (n: number, desde = 0): RegistroEscallo[] => Array.from({ length: n }, (_, i) => ({ data: "2026-11-03 06:00:00", protocolo: `P${desde + i}`, acao: "x", fTokensAcao: 0.02 }));

  it("consulta de vários dias: páginas de 100 até a última, sem repetir", async () => {
    const paginas = [linhas(100, 0), linhas(100, 100), linhas(37, 200)];
    const chamadas: number[] = [];
    const r = await lerRel103Completo(async (p) => { chamadas.push(p); return paginas[p] ?? []; });
    expect(r).toHaveLength(237);
    expect(chamadas).toEqual([0, 1, 2]);
  });

  it("consulta de um dia: a API manda o dia inteiro (mais de 100) em toda página; lê uma vez só", async () => {
    const dia = linhas(2145);
    const chamadas: number[] = [];
    const r = await lerRel103Completo(async (p) => { chamadas.push(p); return dia; });
    expect(r).toHaveLength(2145);
    expect(chamadas).toEqual([0]);
  });

  it("exatamente 100 linhas e a API ignora a paginação (página repetida): não duplica", async () => {
    const cem = linhas(100);
    const r = await lerRel103Completo(async () => cem);
    expect(r).toHaveLength(100);
  });

  it("dia sem consumo: lista vazia; muitas páginas diferentes: falha em vez de gravar pela metade", async () => {
    expect(await lerRel103Completo(async () => [])).toEqual([]);
    await expect(lerRel103Completo(async (p) => linhas(100, p * 100), 3)).rejects.toThrow("não li tudo");
  });
});
