import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  activeChecklist,
  buildAuditPanel,
  clearFeedbackRegistration,
  computeScore,
  createAudit,
  createChecklistVersion,
  createDefaultChecklist,
  filterAudits,
  isChecklistUsed,
  itemsOf,
  monthlyAverages,
  pareceDadoPessoal,
  registerFeedback,
  totalWeight,
  validateAuditInput,
  validateFeedbackDate,
  validateSettings,
} from "./auditLogic";
import { saveAttendants } from "./attendantsStorage";
import { saveAuditChecklists, saveAuditItems, saveAuditSettings, saveAudits } from "./auditStorage";
import { getLocalDateString } from "./performanceStorage";
import { EllosDataProvider } from "@/contexts/EllosDataContext";
import Audits from "@/pages/Audits";
import AuditChecklistCard from "@/components/AuditChecklistCard";
import type { Attendant } from "@/types/attendant";
import { DEFAULT_AUDIT_SETTINGS, type Audit, type AuditAnswer, type AuditItem } from "@/types/audit";

// Os testes de tela rodam como administrador
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { email: "gestor@exemplo.com", role: "admin" }, isAdmin: true, loading: false, logout: async () => {} }),
}));

// Todos os dados abaixo são inventados. Datas relativas a hoje.
const hoje = getLocalDateString();
const dia = (delta: number) => {
  const d = new Date(`${hoje}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
};

function pessoa(id: number, name: string, extra: Partial<Attendant> = {}): Attendant {
  return {
    id, name, role: "Atendente", serviceChannel: "Ligação", workingHours: "6h20", jornadaStart: "08:00", jornadaEnd: "14:00",
    observation: "", registrationDate: "2026-01-01", ...extra,
  };
}
const ana = pessoa(1, "Ana Teste");
const bia = pessoa(2, "Bia Teste");
const caio = pessoa(3, "Caio Teste");
const saiu = pessoa(5, "Davi Saiu", { active: false, terminatedOn: dia(-40) } as Partial<Attendant>);

const itensSimples = (): AuditItem[] => [
  { id: 1, checklistId: 100, position: 1, title: "Abertura", hint: "", weight: 10, eliminatory: false, active: true },
  { id: 2, checklistId: 100, position: 2, title: "Informação correta", hint: "", weight: 20, eliminatory: true, active: true },
  { id: 3, checklistId: 100, position: 3, title: "Encerramento", hint: "", weight: 10, eliminatory: false, active: true },
];
const resp = (itemId: number, result: AuditAnswer["result"], note = ""): AuditAnswer => ({ itemId, result, note });

describe("auditoria: nota", () => {
  it("Atende vale tudo, Parcial metade, Não atende zero", () => {
    const itens = itensSimples();
    expect(computeScore([resp(1, "atende"), resp(2, "atende"), resp(3, "atende")], itens).score).toBe(100);
    expect(computeScore([resp(1, "parcial"), resp(2, "atende"), resp(3, "atende")], itens).score).toBe(87.5); // (5+20+10)/40
    expect(computeScore([resp(1, "nao_atende"), resp(2, "atende"), resp(3, "atende")], itens).score).toBe(75); // 30/40
  });

  it("'Não se aplica' não conta e a nota é recalculada sobre o que valeu", () => {
    const itens = itensSimples();
    // 10 + 20 de 30 valeram: abertura atende (10), informação parcial (10), encerramento não se aplica
    const r = computeScore([resp(1, "atende"), resp(2, "parcial"), resp(3, "nao_aplica")], itens);
    expect(r.score).toBe(66.7);
    expect(r.validWeight).toBe(30);
  });

  it("tudo 'Não se aplica' fica sem nota", () => {
    expect(computeScore([resp(1, "nao_aplica"), resp(2, "nao_aplica"), resp(3, "nao_aplica")], itensSimples()).score).toBeUndefined();
  });

  it("critério eliminatório em 'Não atende' zera a nota; em 'Parcial' não", () => {
    const itens = itensSimples();
    const zerada = computeScore([resp(1, "atende"), resp(2, "nao_atende"), resp(3, "atende")], itens);
    expect(zerada).toMatchObject({ score: 0, eliminated: true });
    const parcial = computeScore([resp(1, "atende"), resp(2, "parcial"), resp(3, "atende")], itens);
    expect(parcial.eliminated).toBe(false);
    expect(parcial.score).toBe(75);
  });

  it("critério eliminatório 'Não se aplica' não zera", () => {
    const r = computeScore([resp(1, "atende"), resp(2, "nao_aplica"), resp(3, "atende")], itensSimples());
    expect(r).toMatchObject({ score: 100, eliminated: false });
  });

  it("checklist padrão soma 100 e tem 3 critérios eliminatórios", () => {
    const { checklist, items } = createDefaultChecklist();
    expect(checklist.status).toBe("active");
    expect(totalWeight(items)).toBe(100);
    expect(items.filter((i) => i.eliminatory)).toHaveLength(3);
    const tudo = items.map((i) => resp(i.id, "atende"));
    expect(computeScore(tudo, items).score).toBe(100);
  });
});

describe("auditoria: versões do checklist", () => {
  it("nova versão copia os critérios com ids novos, arquiva a antiga e a auditoria antiga mantém a dela", () => {
    const { checklist, items } = createDefaultChecklist();
    const audit = createAudit(
      { attendantId: 1, channel: "WhatsApp", attendedOn: dia(-1), protocol: "P-1", answers: items.map((i) => resp(i.id, "atende")), generalNote: "", feedback: "" },
      checklist, items, "gestor@exemplo.com"
    );
    expect(isChecklistUsed([audit], checklist.id)).toBe(true);
    const { archivedOld, created, items: novos } = createChecklistVersion(checklist, items);
    expect(created.version).toBe(2);
    expect(created.previousId).toBe(checklist.id);
    expect(archivedOld.status).toBe("archived");
    expect(novos).toHaveLength(items.length);
    expect(novos.every((n) => n.checklistId === created.id && !items.some((i) => i.id === n.id))).toBe(true);
    expect(isChecklistUsed([audit], created.id)).toBe(false);
    expect(activeChecklist([archivedOld, created], "Atendente")?.id).toBe(created.id);
    expect(audit.checklistId).toBe(checklist.id);
  });
});

describe("auditoria: validação", () => {
  const itens = itensSimples();
  const base = { attendantId: 1, channel: "WhatsApp" as const, attendedOn: dia(-1), protocol: "P-9", answers: [resp(1, "atende"), resp(2, "atende"), resp(3, "atende")], generalNote: "", feedback: "" };

  it("exige colaborador, canal, protocolo, data e todos os critérios", () => {
    expect(validateAuditInput(base, itens, [], hoje)).toBeNull();
    expect(validateAuditInput({ ...base, attendantId: undefined }, itens, [], hoje)).toMatch(/colaborador/);
    expect(validateAuditInput({ ...base, channel: "" }, itens, [], hoje)).toMatch(/canal/);
    expect(validateAuditInput({ ...base, protocol: "  " }, itens, [], hoje)).toMatch(/protocolo/);
    expect(validateAuditInput({ ...base, attendedOn: dia(1) }, itens, [], hoje)).toMatch(/futuro/);
    expect(validateAuditInput({ ...base, answers: [resp(1, "atende")] }, itens, [], hoje)).toBe("Faltam avaliar 2 critérios.");
    expect(validateAuditInput({ ...base, answers: [resp(1, "atende"), resp(2, "atende")] }, itens, [], hoje)).toBe("Falta avaliar 1 critério.");
  });

  it("um atendimento (protocolo + canal) só pode ser auditado uma vez", () => {
    const existentes = [{ id: 7, protocol: "p-9", channel: "WhatsApp" as const }];
    expect(validateAuditInput(base, itens, existentes, hoje)).toMatch(/já foi auditado/);
    expect(validateAuditInput({ ...base, channel: "Ligação" }, itens, existentes, hoje)).toBeNull(); // outro canal
    expect(validateAuditInput(base, itens, existentes, hoje, 7)).toBeNull(); // editando a própria
  });

  it("feedback: data válida, não futura e não anterior ao atendimento; metas com limites", () => {
    expect(validateFeedbackDate(dia(0), hoje, dia(-2))).toBeNull();
    expect(validateFeedbackDate(dia(1), hoje, dia(-2))).toMatch(/futuro/);
    expect(validateFeedbackDate(dia(-3), hoje, dia(-2))).toMatch(/anterior/);
    expect(validateSettings({ minScore: 85, monthlyTarget: 4 })).toBeNull();
    expect(validateSettings({ minScore: 101, monthlyTarget: 4 })).toMatch(/entre 0 e 100/);
    expect(validateSettings({ minScore: 85, monthlyTarget: 2.5 })).toMatch(/inteiro/);
  });

  it("avisa quando o texto parece ter CPF ou e-mail (LGPD)", () => {
    expect(pareceDadoPessoal("paciente 123.456.789-09")).toBe(true);
    expect(pareceDadoPessoal("falar com maria@exemplo.com")).toBe(true);
    expect(pareceDadoPessoal("protocolo 202611100001, bom atendimento")).toBe(false);
  });

  it("registrar o feedback guarda a data e quem registrou (supervisão) e dá para limpar", () => {
    const { checklist, items } = createDefaultChecklist();
    const a = createAudit({ ...base, answers: items.map((i) => resp(i.id, "atende")) }, checklist, items, "g@e.com");
    const dado = registerFeedback(a, dia(0));
    expect(dado).toMatchObject({ feedbackGivenOn: dia(0), ackMode: "supervisora" });
    expect(clearFeedbackRegistration(dado).feedbackGivenOn).toBeUndefined();
  });
});

function auditoria(id: number, attendantId: number, score: number | undefined, attendedOn: string, extra: Partial<Audit> = {}): Audit {
  return {
    id, attendantId, checklistId: 100, channel: "WhatsApp", attendedOn, protocol: `P-${id}`, answers: [], score, eliminated: false,
    generalNote: "", feedback: "", auditorEmail: "g@e.com", createdAt: `${attendedOn}T12:00:00.000Z`, updatedAt: `${attendedOn}T12:00:00.000Z`, ...extra,
  };
}

describe("auditoria: painel", () => {
  const mes = hoje.slice(0, 7);
  const mesAnterior = dia(-40).slice(0, 7);
  const lista = [
    auditoria(1, 1, 90, `${mes}-01`), auditoria(2, 1, 80, `${mes}-02`),
    auditoria(3, 2, 70, `${mes}-03`), auditoria(4, 2, 0, `${mes}-04`, { eliminated: true }),
    auditoria(5, 1, 60, `${mesAnterior}-10`),
  ];
  const painel = buildAuditPanel(lista, [ana, bia, caio, saiu], { id: 1, minScore: 85, monthlyTarget: 4 }, mes);

  it("média por colaborador, quantidade contra a meta e destaque de quem ficou abaixo", () => {
    const ana1 = painel.rows.find((r) => r.attendant.id === 1)!;
    expect(ana1).toMatchObject({ count: 2, average: 85, missing: 2, belowMin: false });
    const bia2 = painel.rows.find((r) => r.attendant.id === 2)!;
    expect(bia2).toMatchObject({ count: 2, average: 35, belowMin: true, eliminatedCount: 1 });
    expect(painel.rows.find((r) => r.attendant.id === 3)).toMatchObject({ count: 0, average: undefined, belowMin: false, missing: 4 });
    expect(painel.belowMin.map((r) => r.attendant.name)).toEqual(["Bia Teste"]);
    expect(painel.totalAudits).toBe(4);
    expect(painel.overallAverage).toBe(60); // (90+80+70+0)/4
  });

  it("desligado há muito tempo não entra no painel; mês antigo mostra só o que houve nele", () => {
    expect(painel.rows.some((r) => r.attendant.id === 5)).toBe(false);
    const antigo = buildAuditPanel(lista, [ana, bia, caio], DEFAULT_AUDIT_SETTINGS, mesAnterior);
    expect(antigo.rows.find((r) => r.attendant.id === 1)).toMatchObject({ count: 1, average: 60, belowMin: true });
  });

  it("nota média por mês de um colaborador e filtros da lista", () => {
    expect(monthlyAverages(lista, 1)).toEqual([
      { month: mesAnterior, average: 60, count: 1 },
      { month: mes, average: 85, count: 2 },
    ]);
    expect(filterAudits(lista, [ana, bia], { onlyBelowMin: true, month: mes }, 85).map((a) => a.id).sort()).toEqual([2, 3, 4]);
    expect(filterAudits(lista, [ana, bia], { search: "bia" }, 85).map((a) => a.id).sort()).toEqual([3, 4]);
    expect(filterAudits(lista, [ana, bia], { search: "P-5" }, 85).map((a) => a.id)).toEqual([5]);
  });
});

describe("auditoria: telas", () => {
  beforeAll(() => {
    // jsdom não tem estes métodos que o Radix usa nas listas
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.setPointerCapture ??= () => {};
    Element.prototype.releasePointerCapture ??= () => {};
    Element.prototype.scrollIntoView ??= () => {};
  });
  beforeEach(() => {
    window.localStorage.clear();
    saveAttendants([ana, bia, caio]);
    const { checklist, items } = createDefaultChecklist();
    saveAuditChecklists([checklist]);
    saveAuditItems(items);
    saveAuditSettings(DEFAULT_AUDIT_SETTINGS);
    saveAudits([]);
  });
  afterEach(() => cleanup());

  it("audita um atendimento do WhatsApp: busca a conversa inventada, avalia, vê a nota ao vivo e salva sem guardar a conversa", async () => {
    const user = userEvent.setup();
    render(
      <EllosDataProvider>
        <Audits />
      </EllosDataProvider>
    );
    await user.click(screen.getByTestId("nova-auditoria"));
    const dialogo = await screen.findByTestId("auditoria-dialogo");

    await user.click(within(dialogo).getByTestId("aud-colaborador"));
    await user.click(await screen.findByRole("option", { name: "Ana Teste" }));
    await user.click(within(dialogo).getByTestId("aud-canal"));
    await user.click(await screen.findByRole("option", { name: "WhatsApp" }));
    await user.type(within(dialogo).getByLabelText(/Protocolo da Escallo/), "202611100001");

    // o ambiente de teste mostra uma conversa inventada, com aviso
    await user.click(within(dialogo).getByTestId("buscar-atendimento"));
    expect(await within(dialogo).findByTestId("conversa")).toBeTruthy();
    expect(within(dialogo).getByTestId("aviso-inventado").textContent).toMatch(/inventada/);

    // salvar sem avaliar tudo é recusado
    await user.click(within(dialogo).getByTestId("salvar-auditoria"));
    expect(within(dialogo).getByRole("alert").textContent).toBe("Faltam avaliar 10 critérios.");

    // avalia todos como "Atende"
    for (let n = 1; n <= 10; n++) {
      const item = within(dialogo).getByTestId(`aud-item-${n}`);
      await user.click(within(item).getByRole("radio", { name: "Atende" }));
    }
    expect(within(dialogo).getByTestId("nota-ao-vivo").textContent).toContain("100");

    // um critério eliminatório em "Não atende" zera a nota na hora
    await user.click(within(within(dialogo).getByTestId("aud-item-4")).getByRole("radio", { name: "Não atende" }));
    expect(within(dialogo).getByTestId("selo-eliminatorio")).toBeTruthy();
    expect(within(dialogo).getByTestId("nota-ao-vivo").textContent).toContain("0");
    await user.click(within(within(dialogo).getByTestId("aud-item-4")).getByRole("radio", { name: "Parcial (metade)" }));
    expect(within(dialogo).getByTestId("nota-ao-vivo").textContent).toContain("90"); // 100 - metade de 20

    await user.type(within(dialogo).getByLabelText(/Feedback para o agente/), "Ótimo atendimento.");
    await user.click(within(dialogo).getByTestId("salvar-auditoria"));

    await waitFor(() => expect(screen.queryByTestId("auditoria-dialogo")).toBeNull());
    const salvo = JSON.parse(window.localStorage.getItem("ellos-audits") ?? "[]") as Audit[];
    expect(salvo).toHaveLength(1);
    expect(salvo[0]).toMatchObject({ attendantId: 1, channel: "WhatsApp", protocol: "202611100001", score: 90, feedback: "Ótimo atendimento." });
    // LGPD: nada da conversa foi guardado
    expect(JSON.stringify(salvo)).not.toContain("Maria Exemplo");
    expect(JSON.stringify(window.localStorage)).not.toContain("hemograma");
  });

  it("ligação: acha a gravação e carrega o player (áudio inventado no teste)", async () => {
    const user = userEvent.setup();
    URL.createObjectURL = vi.fn(() => "blob:audio-inventado");
    URL.revokeObjectURL = vi.fn();
    render(
      <EllosDataProvider>
        <Audits />
      </EllosDataProvider>
    );
    await user.click(screen.getByTestId("nova-auditoria"));
    const dialogo = await screen.findByTestId("auditoria-dialogo");
    await user.click(within(dialogo).getByTestId("aud-canal"));
    await user.click(await screen.findByRole("option", { name: "Ligação" }));
    await user.type(within(dialogo).getByLabelText(/Protocolo da Escallo/), "202611100077");
    await user.click(within(dialogo).getByTestId("buscar-atendimento"));
    expect(await within(dialogo).findByTestId("ligacao")).toBeTruthy();
    await user.click(within(dialogo).getByTestId("carregar-audio"));
    expect(await within(dialogo).findByTestId("player-audio")).toBeTruthy();
  });

  it("não deixa auditar o mesmo atendimento duas vezes", async () => {
    const { checklist, items } = createDefaultChecklist();
    saveAuditChecklists([checklist]);
    saveAuditItems(items);
    saveAudits([auditoria(50, 1, 90, dia(-1), { checklistId: checklist.id, protocol: "REPETIDO", answers: items.map((i) => resp(i.id, "atende")) })]);
    const user = userEvent.setup();
    render(
      <EllosDataProvider>
        <Audits />
      </EllosDataProvider>
    );
    await user.click(screen.getByTestId("nova-auditoria"));
    const dialogo = await screen.findByTestId("auditoria-dialogo");
    await user.click(within(dialogo).getByTestId("aud-colaborador"));
    await user.click(await screen.findByRole("option", { name: "Bia Teste" }));
    await user.click(within(dialogo).getByTestId("aud-canal"));
    await user.click(await screen.findByRole("option", { name: "WhatsApp" }));
    await user.type(within(dialogo).getByLabelText(/Protocolo da Escallo/), "repetido");
    for (let n = 1; n <= 10; n++) await user.click(within(within(dialogo).getByTestId(`aud-item-${n}`)).getByRole("radio", { name: "Atende" }));
    await user.click(within(dialogo).getByTestId("salvar-auditoria"));
    expect(within(dialogo).getByRole("alert").textContent).toMatch(/já foi auditado/);
  });

  it("painel destaca quem ficou abaixo da nota mínima e lista as auditorias", async () => {
    const { checklist, items } = createDefaultChecklist();
    saveAuditChecklists([checklist]);
    saveAuditItems(items);
    const mes = hoje.slice(0, 7);
    saveAudits([
      auditoria(60, 1, 95, `${mes}-01`, { checklistId: checklist.id }),
      auditoria(61, 2, 70, `${mes}-01`, { checklistId: checklist.id }),
    ]);
    const user = userEvent.setup();
    render(
      <EllosDataProvider>
        <Audits />
      </EllosDataProvider>
    );
    const bia2 = within(screen.getByTestId("painel-colaboradores")).getByText("Bia Teste").closest("tr") as HTMLElement;
    expect(within(bia2).getByTestId("selo-abaixo-minimo").textContent).toContain("Abaixo de 85");
    const ana1 = within(screen.getByTestId("painel-colaboradores")).getByText("Ana Teste").closest("tr") as HTMLElement;
    expect(within(ana1).queryByTestId("selo-abaixo-minimo")).toBeNull();
    await user.click(screen.getByTestId("aba-lista"));
    expect(await screen.findAllByTestId("linha-auditoria")).toHaveLength(2);
  });

  it("configurações: checklist usado trava peso/título e oferece nova versão; metas salvam", async () => {
    const { checklist, items } = createDefaultChecklist();
    saveAuditChecklists([checklist]);
    saveAuditItems(items);
    saveAudits([auditoria(70, 1, 100, dia(-1), { checklistId: checklist.id, answers: items.map((i) => resp(i.id, "atende")) })]);
    const user = userEvent.setup();
    render(
      <EllosDataProvider>
        <AuditChecklistCard />
      </EllosDataProvider>
    );
    expect(screen.getByTestId("checklist-travado").textContent).toMatch(/1 auditoria/);
    expect((screen.getByRole("button", { name: "Editar Abertura: saudação e identificação" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: /Criar nova versão/ }));
    await user.click(screen.getAllByRole("button", { name: "Criar nova versão" }).at(-1)!);
    await waitFor(() => expect(screen.getAllByText(/Versão 2/).length).toBeGreaterThan(0));
    // agora o checklist novo está livre para editar
    expect((screen.getByRole("button", { name: "Editar Abertura: saudação e identificação" }) as HTMLButtonElement).disabled).toBe(false);

    await user.clear(screen.getByLabelText(/Nota mínima/));
    await user.type(screen.getByLabelText(/Nota mínima/), "90");
    await user.clear(screen.getByLabelText(/Meta de auditorias/));
    await user.type(screen.getByLabelText(/Meta de auditorias/), "6");
    await user.click(screen.getByRole("button", { name: "Salvar metas" }));
    const salvas = JSON.parse(window.localStorage.getItem("ellos-audit-settings") ?? "[]");
    expect(salvas[0]).toMatchObject({ minScore: 90, monthlyTarget: 6 });
    expect(itemsOf(JSON.parse(window.localStorage.getItem("ellos-audit-items") ?? "[]"), checklist.id)).toHaveLength(items.length);
  });
});
