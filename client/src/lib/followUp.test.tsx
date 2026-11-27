import { describe, expect, it, vi } from "vitest";
import { areaDoOrcamento, empresaEnviouOrcamento, extrairOrcamentos, lerOrcamentosDoDia, orcamentosParaTabela } from "../../../supabase/functions/escallo-sync/orcamentos";
import { sincronizar, type Deps } from "../../../supabase/functions/escallo-sync/sincronizar";
import { aplicarContato, filtrarFollowUps, motivosDePerda, resumirFollowUps, validarContato } from "./followUpLogic";
import type { FollowUp, FollowUpUpdate } from "@/types/followUp";

const arquivoEnviado = { direcao: "Enviado", tipo: "Arquivo", conteudo: "segredo" };
const conversa = (id: number, classificacao: string, extra: Record<string, unknown> = {}) => ({
  id,
  classificacao: { id: 1, nome: classificacao },
  clienteContato: `contato-${id}`,
  mensagensContato: [{ conteudo: "texto do paciente" }],
  atendimentos: [{ protocolo: `P${id}`, agente: { codigo: 10, nome: "Agente Teste" }, mensagens: [arquivoEnviado] }],
  ...extra,
});

describe("Follow-up: orçamentos vindos da Escallo", () => {
  it("reconhece a área pela classificação e ignora as demais", () => {
    expect(areaDoOrcamento("Orçamento AC ")).toBe("laboratorio");
    expect(areaDoOrcamento("Orçamento DI")).toBe("imagem");
    expect(areaDoOrcamento("Orçamento particular")).toBe("outros");
    expect(areaDoOrcamento("Dúvidas sobre preparo")).toBeNull();
    expect(areaDoOrcamento(undefined)).toBeNull();
  });

  it("guarda só protocolo, área e atendente: nada do paciente sai da extração", () => {
    const linhas = extrairOrcamentos("2026-11-26", [conversa(1, "Orçamento AC"), conversa(2, "Resultado AC")]);
    expect(linhas).toEqual([{ chatId: 1, protocolo: "P1", dia: "2026-11-26", area: "laboratorio", codigoAgente: 10, nomeAgente: "Agente Teste" }]);
    expect(JSON.stringify(linhas)).not.toMatch(/contato|segredo|texto do paciente/);
  });

  it("só entra quando a empresa enviou valor, arquivo ou imagem", async () => {
    const com = (...mensagens: Record<string, string>[]) => conversa(1, "Orçamento AC", { atendimentos: [{ protocolo: "P1", agente: { codigo: 10 }, mensagens }] });
    const texto = (direcao: string, conteudo: string) => ({ direcao, tipo: "Texto", conteudo });
    expect(empresaEnviouOrcamento(com(texto("Enviado", "O hemograma fica R$ 35")))).toBe(true);
    expect(empresaEnviouOrcamento(com(texto("Enviado", "Total: 1.250,00")))).toBe(true);
    expect(empresaEnviouOrcamento(com({ direcao: "Enviado", tipo: "Imagem", conteudo: "" }))).toBe(true);
    const sem = [
      com(),
      com(texto("Enviado", "Já vou verificar, um momento")),
      com(texto("Recebido", "Me cobraram R$ 40")),
      com({ direcao: "Recebido", tipo: "Arquivo", conteudo: "pedido médico" }),
    ];
    for (const c of sem) expect(extrairOrcamentos("2026-11-26", [c])).toEqual([]);
    expect(await lerOrcamentosDoDia("2026-11-26", async () => [sem[3]])).toEqual([]);
    expect(await lerOrcamentosDoDia("2026-11-26", async () => [com(texto("Enviado", "R$ 35"))])).toHaveLength(1);
  });

  it("o mesmo contato na mesma área conta uma vez (fica a conversa mais recente); áreas diferentes contam as duas", () => {
    const mesmo = { clienteContato: "x" };
    const linhas = extrairOrcamentos("2026-11-26", [conversa(5, "Orçamento AC", mesmo), conversa(3, "Orçamento AC", mesmo), conversa(4, "Orçamento DI", mesmo)]);
    expect(linhas.map((l) => l.chatId)).toEqual([4, 5]);
  });

  it("usa o último atendimento com agente (depois da triagem) e pula conversa sem protocolo", () => {
    const linhas = extrairOrcamentos("2026-11-26", [
      conversa(1, "Orçamento AC", { atendimentos: [{ protocolo: "A", agente: { codigo: 1, nome: "Triagem" } }, { protocolo: "B", agente: { codigo: 2, nome: "Fez" }, mensagens: [arquivoEnviado] }] }),
      conversa(2, "Orçamento AC", { atendimentos: [] }),
    ]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ protocolo: "B", codigoAgente: 2 });
  });

  it("lê todas as páginas até a incompleta", async () => {
    const paginas = Array.from({ length: 6 }, (_, p) => Array.from({ length: p === 5 ? 3 : 100 }, (_, i) => conversa(p * 100 + i + 1, i === 0 ? "Orçamento AC" : "Outra")));
    const buscar = vi.fn(async (p: number) => paginas[p] ?? []);
    const linhas = await lerOrcamentosDoDia("2026-11-26", buscar);
    expect(linhas).toHaveLength(6);
    expect(buscar).toHaveBeenCalledTimes(8);
    await expect(lerOrcamentosDoDia("2026-11-26", async (p) => paginas[0].map((c) => ({ ...c, id: p * 100 + c.id })), 8)).rejects.toThrow(/não li tudo/);
  });

  it("liga o atendente pelo código e não envia colunas do acompanhamento", () => {
    const [linha] = orcamentosParaTabela(extrairOrcamentos("2026-11-26", [conversa(1, "Orçamento DI")]), [{ id: 77, name: "Nome no Ellos", escallo_codigo: "10" }]);
    expect(linha).toEqual({ chat_id: 1, protocol: "P1", date: "2026-11-26", area: "imagem", attendant_id: 77, attendant_name: "Nome no Ellos" });
  });

  const deps = (buscados: string[]): Deps => ({
    buscarRelatorio: async () => [],
    lerColaboradores: async () => [],
    lerLimiteLogin: async () => null,
    aplicarDia: async () => ({ inseridas: 0, atualizadas: 0, puladas_manuais: 0, alertas_novos: 0 }),
    esperar: async () => {},
    buscarOrcamentos: async (dia) => {
      buscados.push(dia);
      return [];
    },
    gravarOrcamentos: async () => {},
  });

  it("entra no fechamento (dia anterior e anteontem) e nunca na hora em hora", async () => {
    const fechamento: string[] = [];
    await sincronizar(deps(fechamento), { modo: "fechamento" }, "2026-11-26");
    expect(fechamento).toEqual(["2026-11-25", "2026-11-24"]);
    const hoje: string[] = [];
    await sincronizar(deps(hoje), { modo: "hoje" }, "2026-11-26");
    await sincronizar(deps(hoje), { modo: "agora" }, "2026-11-26");
    await sincronizar(deps(hoje), { modo: "simulacao", dias: ["2026-11-25"] }, "2026-11-26");
    expect(hoje).toEqual([]);
  });

  it("falha nos orçamentos não derruba a sincronização", async () => {
    const d = deps([]);
    d.buscarOrcamentos = async () => {
      throw new Error("sem resposta");
    };
    const r = await sincronizar(d, { modo: "manual", dias: ["2026-11-25"] }, "2026-11-26");
    expect(r.orcamentos.erros[0]).toContain("sem resposta");
  });
});

const item = (id: number, extra: Partial<FollowUp> = {}): FollowUp => ({
  id, protocol: `P${id}`, date: "2026-11-20", area: "laboratorio", attendantId: 1, attendantName: "Ana Teste", status: "pending",
  declineReason: null, note: "", nextContactOn: null, attempts: 0, lastContactAt: null, handledBy: "", ...extra,
});

describe("Follow-up: contas da tela", () => {
  const lista = [
    item(1),
    item(2, { status: "waiting", nextContactOn: "2026-11-30" }),
    item(3, { status: "waiting", nextContactOn: "2026-11-25" }),
    item(4, { status: "recovered" }),
    item(5, { status: "already_done" }),
    item(6, { status: "declined", declineReason: "price", date: "2026-11-24" }),
  ];

  it("a taxa de recuperação deixa fora quem já tinha feito", () => {
    expect(resumirFollowUps(lista, "2026-11-27")).toMatchObject({ total: 6, pending: 1, waiting: 2, recovered: 1, recoveryRate: 20, dueReturns: 1 });
    expect(resumirFollowUps([], "2026-11-27").recoveryRate).toBeNull();
    expect(motivosDePerda(lista)).toEqual([{ motivo: "price", quantidade: 1 }]);
  });

  it("aguardando: retorno mais atrasado primeiro; nas outras listas, o pedido mais recente", () => {
    const base = { area: "all" as const, attendant: "all", search: "" };
    expect(filtrarFollowUps(lista, { ...base, status: "waiting" }).map((f) => f.id)).toEqual([3, 2]);
    expect(filtrarFollowUps(lista, { ...base, status: "all" })[0].id).toBe(6);
    expect(filtrarFollowUps(lista, { ...base, status: "all", search: "p4" }).map((f) => f.id)).toEqual([4]);
  });

  it("exige motivo para quem não vai fazer e limpa o que não vale para o resultado", () => {
    const u: FollowUpUpdate = { status: "declined", declineReason: null, note: " ok ", nextContactOn: "2026-11-30", countAttempt: true };
    expect(validarContato(u, "2026-11-27")).toContain("motivo");
    expect(validarContato({ ...u, status: "waiting", nextContactOn: "2026-11-20" }, "2026-11-27")).toContain("data futura");
    const salvo = aplicarContato(item(1), { ...u, status: "recovered", declineReason: "price" }, "gestora", new Date("2026-11-27T15:00:00Z"));
    expect(salvo).toMatchObject({ status: "recovered", declineReason: null, nextContactOn: null, note: "ok", attempts: 1, handledBy: "gestora" });
    expect(aplicarContato(item(1), { ...u, countAttempt: false }, "g", new Date()).attempts).toBe(0);
  });
});
