import { describe, expect, it } from "vitest";
import { listarLigacoesDoAgente, UNIQUEID_LIGACAO } from "../../../supabase/functions/escallo-atendimento/ligacoes";
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
