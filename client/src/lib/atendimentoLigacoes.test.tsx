import { describe, expect, it } from "vitest";
import { listarConversasDoAgente, listarLigacoesDoAgente, resumirTransferencias, UNIQUEID_LIGACAO } from "../../../supabase/functions/escallo-atendimento/ligacoes";
import { pareceIdLigacao } from "./atendimentoEscallo";

// Dados inventados no formato dos relatórios da Escallo (rel001 = chamadas de fila, rel002 = ligações com o agente)
const fila = (u: string, hora: string, extra: Record<string, unknown> = {}) => ({
  "filaAtendimentoLigacao.uniqueid": u,
  "filaAtendimentoLigacao.primaryUniqueid": u,
  "filaAtendimentoLigacao.dataHoraInicial": `2026-11-19 ${hora}`,
  "filaAtendimentoLigacao.statusFormatado": "Atendida",
  "filaAtendimentoLigacao.tempoAtendimento": 120,
  "telefoniaFilaAtendimento.nome": "USG",
  ...extra,
});
const lig = (u: string, primary: string, codigo: string) => ({
  "ligacao.uniqueid": u,
  "ligacao.primaryUniqueid": primary,
  "ligacao.codigoAgenteDestino": codigo,
  "protocolo.numero": "",
});

describe("lista de ligações do agente (rel001 + rel002)", () => {
  it("aceita o identificador real da Escallo (5 casas decimais) e recusa lixo", () => {
    expect(UNIQUEID_LIGACAO.test("1763560000.12345")).toBe(true);
    expect(pareceIdLigacao("1763560000.12345")).toBe(true);
    expect(pareceIdLigacao("202611100001")).toBe(false); // protocolo do WhatsApp não é identificador de ligação
    expect(pareceIdLigacao("../etc/passwd")).toBe(false);
  });

  it("lista só as atendidas do agente, da mais antiga para a mais nova", () => {
    const rel001 = [
      fila("1763560300.00003", "09:30:00"),
      fila("1763560100.00001", "08:10:00"),
      fila("1763560200.00002", "08:50:00", { "filaAtendimentoLigacao.statusFormatado": "Abandonada pelo chamador" }),
      fila("1763560400.00004", "10:00:00"),
    ];
    const rel002 = [
      lig("1763560301.00009", "1763560300.00003", "1010"),
      lig("1763560100.00001", "1763560100.00001", "1010"),
      lig("1763560200.00002", "1763560200.00002", "1010"),
      lig("1763560401.00010", "1763560400.00004", "1015"),
    ];
    const r = listarLigacoesDoAgente(rel001, rel002, "1010");
    expect(r.map((l) => l.uniqueid)).toEqual(["1763560100.00001", "1763560300.00003"]);
    expect(r[0]).toMatchObject({ inicio: "2026-11-19 08:10:00", fila: "USG", segundos: 120 });
    expect(listarLigacoesDoAgente(rel001, rel002, "1015").map((l) => l.uniqueid)).toEqual(["1763560400.00004"]);
    expect(listarLigacoesDoAgente(rel001, rel002, "9999")).toEqual([]);
  });

  it("ignora identificador inválido e repetido, e não devolve telefone nem nome", () => {
    const rel001 = [
      fila("1763560100.00001", "08:10:00", { "filaAtendimentoLigacao.origem": "11999990000" }),
      fila("1763560100.00001", "08:10:00"),
      fila("sem-id", "08:20:00"),
    ];
    const rel002 = [lig("1763560100.00001", "1763560100.00001", "1010"), lig("sem-id", "sem-id", "1010")];
    const r = listarLigacoesDoAgente(rel001, rel002, "1010");
    expect(r).toHaveLength(1);
    expect(Object.keys(r[0]).sort()).toEqual(["fila", "inicio", "segundos", "uniqueid"]);
    expect(JSON.stringify(r)).not.toContain("11999990000");
  });
});

// historicoMensagens: cada registro traz atendimentos[] com o agente, o protocolo e as mensagens
const atend = (codigo: number, protocolo: string, hora: string, mensagens: number, extra: Record<string, unknown> = {}) => ({
  agente: { id: 1, codigo, nome: "Agente Inventado" },
  protocolo,
  dataHoraInicial: `2026-11-19 ${hora}`,
  tempoAtendimento: 300,
  mensagens: Array.from({ length: mensagens }, (_, i) => ({ id: i, conteudo: "texto sigiloso do paciente" })),
  ...extra,
});

describe("lista de conversas do agente (WhatsApp)", () => {
  it("lista só as conversas do agente, sem repetir protocolo, da mais antiga para a mais nova", () => {
    const registros = [
      { id: 1, atendimentos: [atend(1031, "20261119000002", "10:30:00", 8)] },
      { id: 2, atendimentos: [atend(1031, "20261119000001", "09:15:00", 5), atend(1038, "20261119000003", "09:20:00", 4)] },
      { id: 3, atendimentos: [atend(1031, "20261119000001", "09:15:00", 5)] }, // mesmo protocolo de novo
      { id: 4, atendimentos: [] }, // só o robô
    ];
    const r = listarConversasDoAgente(registros, "1031");
    expect(r.map((c) => c.protocolo)).toEqual(["20261119000001", "20261119000002"]);
    expect(r[0]).toEqual({ protocolo: "20261119000001", inicio: "2026-11-19 09:15:00", segundos: 300, mensagens: 5 });
    expect(listarConversasDoAgente(registros, "1038").map((c) => c.protocolo)).toEqual(["20261119000003"]);
    expect(listarConversasDoAgente(registros, "9999")).toEqual([]);
  });

  it("ignora atendimento sem mensagem ou com protocolo inválido e nunca devolve o texto das mensagens", () => {
    const registros = [
      { id: 1, atendimentos: [atend(1031, "20261119000001", "09:00:00", 0), atend(1031, "../hack", "09:10:00", 3), atend(1031, "20261119000009", "09:20:00", 2)] },
    ];
    const r = listarConversasDoAgente(registros, "1031");
    expect(r.map((c) => c.protocolo)).toEqual(["20261119000009"]);
    expect(Object.keys(r[0]).sort()).toEqual(["inicio", "mensagens", "protocolo", "segundos"]);
    expect(JSON.stringify(r)).not.toContain("sigiloso");
  });
});

describe("triagem: transferências do agente no dia", () => {
  const at = (cod: string, nome: string, protocolo: string) => ({ agente: { codigo: cod, nome }, protocolo, mensagens: [{}] });
  const regs = [
    { atendimentos: [at("1008", "Gestora Teste", "P1"), at("1031", "Ana Teste", "P1")] },
    { atendimentos: [at("1008", "Gestora Teste", "P2"), at("1031", "Ana Teste", "P2"), at("1032", "Bia Teste", "P2")] },
    { atendimentos: [at("1008", "Gestora Teste", "P3"), at("1032", "Bia Teste", "P3")] },
    { atendimentos: [at("1008", "Gestora Teste", "P4")] },
    { atendimentos: [at("1031", "Ana Teste", "P5")] },
    { atendimentos: [at("1008", "Gestora Teste", "P1"), at("1031", "Ana Teste", "P1")] }, // repetida em outra página
  ];
  it("conta as conversas dela, quantas passaram para outro agente e para quem (primeiro seguinte)", () => {
    const r = resumirTransferencias(regs, "1008");
    expect(r).toMatchObject({ conversas: 4, transferidas: 3, semTransferencia: 1 });
    expect(r.destinos.map((d) => [d.nome, d.quantidade])).toEqual([["Ana Teste", 2], ["Bia Teste", 1]]);
  });
  it("agente sem conversas dá zero e não devolve protocolo nem texto", () => {
    expect(resumirTransferencias(regs, "9999")).toEqual({ conversas: 0, transferidas: 0, semTransferencia: 0, destinos: [] });
    expect(JSON.stringify(resumirTransferencias(regs, "1008"))).not.toMatch(/P1|P2|mensagens/);
  });
});
