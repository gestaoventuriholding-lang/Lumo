import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  appliesToLabel,
  applyRuleUpdate,
  archiveRule,
  canUnarchive,
  createNewVersion,
  createRule,
  filterRules,
  isRequiredToSign,
  removeSignature,
  ruleStatus,
  setSignature,
  signAllPending,
  summarizeRules,
  validateRuleInput,
  validateSignedOn,
  versionChain,
} from "./ruleLogic";
import { saveAttendants } from "./attendantsStorage";
import { saveRuleSignatures, saveRules } from "./ruleStorage";
import { getLocalDateString } from "./performanceStorage";
import { EllosDataProvider } from "@/contexts/EllosDataContext";
import Rules from "@/pages/Rules";
import type { Attendant } from "@/types/attendant";
import type { Rule, RuleSignature } from "@/types/rule";

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
function regra(id: number, extra: Partial<Rule> = {}): Rule {
  return {
    id, title: `Regra ${id}`, description: "Texto da regra de teste", effectiveFrom: dia(-10), appliesTo: "all", status: "active",
    version: 1, createdByEmail: "gestor@exemplo.com", createdAt: `${dia(-10)}T12:00:00.000Z`, updatedAt: `${dia(-10)}T12:00:00.000Z`, ...extra,
  };
}
let seq = 1000;
function assin(ruleId: number, attendantId: number, signedOn = dia(-9), note = ""): RuleSignature {
  seq += 1;
  return { id: seq, ruleId, attendantId, signedOn, note, createdAt: `${signedOn}T12:00:00.000Z`, updatedAt: `${signedOn}T12:00:00.000Z` };
}

const ana = pessoa(1, "Ana Teste");
const bia = pessoa(2, "Bia Teste");
const caio = pessoa(3, "Caio Teste");
const confirma = pessoa(4, "Cora Confirma", { role: "Confirmação de agenda" });
const saiu = pessoa(5, "Davi Saiu", { active: false, terminatedOn: dia(-4) } as Partial<Attendant>);

describe("regras: quem precisa assinar", () => {
  it("a regra alcança pela função: todos, só Atendimento ou só Confirmação", () => {
    expect(isRequiredToSign(regra(1, { appliesTo: "all" }), confirma, hoje)).toBe(true);
    expect(isRequiredToSign(regra(1, { appliesTo: "Atendente" }), confirma, hoje)).toBe(false);
    expect(isRequiredToSign(regra(1, { appliesTo: "Atendente" }), ana, hoje)).toBe(true);
    expect(isRequiredToSign(regra(1, { appliesTo: "Confirmação de agenda" }), ana, hoje)).toBe(false);
    expect(isRequiredToSign(regra(1, { appliesTo: "Confirmação de agenda" }), confirma, hoje)).toBe(true);
    expect(appliesToLabel("Confirmação de agenda")).toBe("Só Confirmação de agenda");
  });

  it("desligado conta como pendente até o último dia trabalhado; do dia seguinte em diante não", () => {
    const r = regra(1, { effectiveFrom: dia(-10) });
    const desligado = { role: "Atendente", terminatedOn: dia(-4) };
    expect(isRequiredToSign(r, desligado, dia(-5))).toBe(true);
    expect(isRequiredToSign(r, desligado, dia(-4))).toBe(true); // o próprio último dia ainda conta
    expect(isRequiredToSign(r, desligado, dia(-3))).toBe(false); // dia seguinte: não é mais pendente
  });

  it("desligado antes de a regra valer nem entra na conta", () => {
    expect(isRequiredToSign(regra(1, { effectiveFrom: dia(-2) }), { role: "Atendente", terminatedOn: dia(-4) }, dia(-4))).toBe(false);
  });
});

describe("regras: status e filtros", () => {
  const todos = [ana, bia, caio, confirma, saiu];

  it("'Assinada por todos' quando quem precisa assinar assinou (desligado fora da conta, mesmo sem assinar)", () => {
    const r = regra(1);
    const s = ruleStatus(r, todos, [assin(1, 1), assin(1, 2), assin(1, 3), assin(1, 4)], hoje);
    expect(s.label).toBe("Assinada por todos");
    expect(s.allSigned).toBe(true);
    expect(s.pending).toEqual([]);
    expect(s.required.map((a) => a.id)).toEqual([1, 2, 3, 4]); // o Davi (desligado) não conta
  });

  it("'Faltam X' com a lista de quem falta, em ordem alfabética", () => {
    const r = regra(1);
    const s = ruleStatus(r, todos, [assin(1, 1)], hoje);
    expect(s.label).toBe("Faltam 3");
    expect(s.pending.map((a) => a.name)).toEqual(["Bia Teste", "Caio Teste", "Cora Confirma"]);
    expect(s.signedCount).toBe(1);
  });

  it("quem entra depois da regra aparece como pendente", () => {
    const r = regra(1);
    const assinaturas = [assin(1, 1), assin(1, 2), assin(1, 3), assin(1, 4)];
    expect(ruleStatus(r, todos, assinaturas, hoje).allSigned).toBe(true);
    const comNovato = [...todos, pessoa(6, "Eva Nova")];
    const s = ruleStatus(r, comNovato, assinaturas, hoje);
    expect(s.label).toBe("Faltam 1");
    expect(s.pending[0].name).toBe("Eva Nova");
  });

  it("assinatura de quem já saiu continua registrada, mas não gera pendência", () => {
    const r = regra(1);
    const s = ruleStatus(r, todos, [assin(1, 5)], hoje);
    expect(s.signatures).toHaveLength(1);
    expect(s.pending.map((a) => a.id)).not.toContain(5);
  });

  it("sem ninguém aplicável, o rótulo diz isso", () => {
    expect(ruleStatus(regra(1, { appliesTo: "Confirmação de agenda" }), [ana, bia], [], hoje).label).toBe("Sem pessoas aplicáveis");
  });

  it("filtros: todas, pendentes e assinadas por todos; arquivadas só se pedidas", () => {
    const r1 = regra(1, { title: "Assinada" });
    const r2 = regra(2, { title: "Pendente" });
    const r3 = regra(3, { title: "Velha", status: "archived", archivedAt: `${dia(-1)}T12:00:00.000Z` });
    const assinaturas = [assin(1, 1), assin(1, 2), assin(1, 3), assin(1, 4), assin(2, 1)];
    const statusOf = (r: Rule) => ruleStatus(r, todos, assinaturas, hoje);
    const titulos = (lista: Rule[]) => lista.map((r) => r.title);
    expect(titulos(filterRules([r1, r2, r3], statusOf, "todas", false))).toEqual(["Assinada", "Pendente"]);
    expect(titulos(filterRules([r1, r2, r3], statusOf, "pendentes", false))).toEqual(["Pendente"]);
    expect(titulos(filterRules([r1, r2, r3], statusOf, "assinadas", false))).toEqual(["Assinada"]);
    expect(filterRules([r1, r2, r3], statusOf, "todas", true)).toHaveLength(3);
    expect(filterRules([r1, r2, r3], statusOf, "todas", false, "pend").map((r) => r.id)).toEqual([2]);
  });

  it("resumo da lista", () => {
    const r1 = regra(1);
    const r2 = regra(2);
    const assinaturas = [assin(1, 1), assin(1, 2), assin(1, 3), assin(1, 4)];
    const resumo = summarizeRules([r1, r2], (r) => ruleStatus(r, todos, assinaturas, hoje));
    expect(resumo).toEqual({ ativas: 2, pendentes: 1, assinadasPorTodos: 1, pessoasPendentes: 4 });
  });
});

describe("regras: assinaturas", () => {
  it("'marcar todos' assina só os pendentes, na data do treinamento, sem mexer em quem já assinou", () => {
    const r = regra(1);
    const antes = [assin(1, 1, dia(-3), "assinou antes")];
    const pendentes = ruleStatus(r, [ana, bia, caio], antes, hoje).pending;
    const depois = signAllPending(antes, r, pendentes, dia(-2), "Treinamento");
    expect(depois).toHaveLength(3);
    expect(depois.find((s) => s.attendantId === 1)).toEqual(antes[0]);
    expect(depois.filter((s) => s.attendantId !== 1).every((s) => s.signedOn === dia(-2) && s.note === "Treinamento")).toBe(true);
    // repetir não duplica
    expect(signAllPending(depois, r, pendentes, dia(-2))).toHaveLength(3);
  });

  it("ajustar uma pessoa mantém o id; remover tira só a dela", () => {
    const r = regra(1);
    const base = signAllPending([], r, [ana, bia], dia(-5));
    const idAna = base.find((s) => s.attendantId === 1)!.id;
    const ajustado = setSignature(base, 1, 1, dia(-1), "assinou depois");
    expect(ajustado.find((s) => s.attendantId === 1)).toMatchObject({ id: idAna, signedOn: dia(-1), note: "assinou depois" });
    expect(setSignature(ajustado, 1, 3, dia(0))).toHaveLength(3); // pessoa nova: cria
    expect(removeSignature(ajustado, idAna).map((s) => s.attendantId)).toEqual([2]);
  });

  it("validação das datas e dos campos", () => {
    expect(validateSignedOn(dia(-1), hoje)).toBeNull();
    expect(validateSignedOn(dia(1), hoje)).toMatch(/futuro/);
    expect(validateSignedOn("", hoje)).toMatch(/data/);
    expect(validateSignedOn(dia(-1), hoje, "x".repeat(201))).toMatch(/observação/);
    expect(validateRuleInput({ title: "", description: "a", effectiveFrom: hoje, appliesTo: "all" })).toMatch(/título/);
    expect(validateRuleInput({ title: "a", description: " ", effectiveFrom: hoje, appliesTo: "all" })).toMatch(/Descreva/);
    expect(validateRuleInput({ title: "a", description: "b", effectiveFrom: "", appliesTo: "all" })).toMatch(/vigência/);
    expect(validateRuleInput({ title: "a", description: "b", effectiveFrom: hoje, appliesTo: "all" })).toBeNull();
  });
});

describe("regras: cadastro, arquivo e versões", () => {
  it("cria com versão 1, guarda quem cadastrou e limpa os espaços", () => {
    const r = createRule({ title: "  Título  ", description: " Texto ", category: "  ", effectiveFrom: hoje, appliesTo: "all" }, "gestor@exemplo.com");
    expect(r).toMatchObject({ title: "Título", description: "Texto", category: undefined, version: 1, status: "active", createdByEmail: "gestor@exemplo.com" });
  });

  it("editar e arquivar", () => {
    const r = regra(1);
    expect(applyRuleUpdate(r, { title: "Novo", description: "Outro", effectiveFrom: hoje, appliesTo: "Atendente" }).title).toBe("Novo");
    const arq = archiveRule(r);
    expect(arq.status).toBe("archived");
    expect(arq.archivedAt).toBeTruthy();
  });

  it("nova versão: a antiga fica arquivada COM as assinaturas dela; a nova começa sem assinaturas", () => {
    const v1 = regra(1);
    const assinaturas = [assin(1, 1), assin(1, 2)];
    const { archivedOld, created } = createNewVersion(v1, { title: "Texto novo", description: "Mudou", effectiveFrom: hoje, appliesTo: "all" }, "gestor@exemplo.com");
    expect(archivedOld).toMatchObject({ id: 1, status: "archived", version: 1 });
    expect(created).toMatchObject({ version: 2, previousId: 1, status: "active" });
    expect(created.id).not.toBe(1);
    // as assinaturas da v1 continuam apontando para ela; a v2 está limpa
    expect(ruleStatus(archivedOld, [ana, bia], assinaturas, hoje).signatures).toHaveLength(2);
    expect(ruleStatus(created, [ana, bia], assinaturas, hoje).signatures).toHaveLength(0);
    expect(ruleStatus(created, [ana, bia], assinaturas, hoje).label).toBe("Faltam 2");
    // a cadeia de versões, vista de qualquer ponta
    const todas = [archivedOld, created];
    expect(versionChain(todas, created).map((r) => r.version)).toEqual([1, 2]);
    expect(versionChain(todas, archivedOld).map((r) => r.version)).toEqual([1, 2]);
    // reativar a v1 não vale depois que a v2 a substituiu
    expect(canUnarchive(archivedOld, todas)).toBe(false);
    expect(canUnarchive(archiveRule(regra(9)), [archiveRule(regra(9))])).toBe(true);
  });
});

describe("tela de Regras", () => {
  beforeAll(() => {
    const el = Element.prototype as unknown as Record<string, unknown>;
    el.hasPointerCapture ??= () => false;
    el.setPointerCapture ??= () => {};
    el.releasePointerCapture ??= () => {};
    el.scrollIntoView ??= () => {};
  });
  beforeEach(() => {
    window.localStorage.clear();
    saveAttendants([ana, bia, caio, confirma, saiu]);
    saveRules([
      regra(10, { title: "Regra assinada por todos", category: "Qualidade" }),
      regra(11, { title: "Regra com pendências" }),
      regra(12, { title: "Regra velha", status: "archived", archivedAt: `${dia(-1)}T12:00:00.000Z` }),
    ]);
    saveRuleSignatures([assin(10, 1), assin(10, 2), assin(10, 3), assin(10, 4), assin(11, 1)]);
  });
  afterEach(() => cleanup());

  const abrir = () =>
    render(
      <EllosDataProvider>
        <Rules />
      </EllosDataProvider>
    );
  const cartao = (titulo: string) => screen.getByText(titulo).closest('[data-testid="regra"]') as HTMLElement;

  it("mostra o status de cada regra e a lista de quem falta; arquivada fica escondida", () => {
    abrir();
    expect(within(cartao("Regra assinada por todos")).getByTestId("status-regra").textContent).toBe("Assinada por todos");
    const pendente = cartao("Regra com pendências");
    expect(within(pendente).getByTestId("status-regra").textContent).toBe("Faltam 3");
    expect(within(pendente).getByTestId("faltam-nomes").textContent).toContain("Bia Teste, Caio Teste, Cora Confirma");
    expect(screen.queryByText("Regra velha")).toBeNull();
  });

  it("filtro 'Pendentes de assinatura' mostra só as pendentes; 'Assinadas por todos' só as completas", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByTestId("filtro-regras"));
    await user.click(await screen.findByRole("option", { name: "Pendentes de assinatura" }));
    expect(screen.queryByText("Regra assinada por todos")).toBeNull();
    expect(screen.getByText("Regra com pendências")).toBeTruthy();
    await user.click(screen.getByTestId("filtro-regras"));
    await user.click(await screen.findByRole("option", { name: "Assinadas por todos" }));
    expect(screen.getByText("Regra assinada por todos")).toBeTruthy();
    expect(screen.queryByText("Regra com pendências")).toBeNull();
  });

  it("'Marcar todos como assinados' pede a data e deixa a regra 'Assinada por todos'", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(within(cartao("Regra com pendências")).getByTestId("marcar-todos"));
    expect(screen.getByTestId("todos-resumo").textContent).toContain("3 pessoas serão marcadas");
    expect((screen.getByLabelText(/Data do treinamento/) as HTMLInputElement).value).toBe(hoje);
    await user.click(screen.getByTestId("confirmar-todos"));
    expect(within(cartao("Regra com pendências")).getByTestId("status-regra").textContent).toBe("Assinada por todos");
  });

  it("dá para marcar a assinatura de uma pessoa à parte (quem faltou ao treinamento)", async () => {
    const user = userEvent.setup();
    abrir();
    const c = cartao("Regra com pendências");
    await user.click(within(c).getByTestId("ver-assinaturas"));
    const linha = within(c).getByText("Bia Teste").closest("tr") as HTMLElement;
    expect(within(linha).getByText("Pendente")).toBeTruthy();
    await user.click(within(linha).getByRole("button", { name: "Marcar assinatura" }));
    await user.click(screen.getByTestId("confirmar-pessoa"));
    expect(within(cartao("Regra com pendências")).getByTestId("status-regra").textContent).toBe("Faltam 2");
    expect(within(within(cartao("Regra com pendências")).getByText("Bia Teste").closest("tr") as HTMLElement).getByText(/Assinou em/)).toBeTruthy();
  });

  it("regra já assinada não edita: oferece 'Criar nova versão', que arquiva a antiga e cria a v2 sem assinaturas", async () => {
    const user = userEvent.setup();
    abrir();
    const assinada = cartao("Regra assinada por todos");
    expect(within(assinada).queryByRole("button", { name: "Editar" })).toBeNull();
    await user.click(within(assinada).getByTestId("nova-versao"));
    const titulo = screen.getByLabelText(/Título/) as HTMLInputElement;
    await user.clear(titulo);
    await user.type(titulo, "Regra assinada por todos (revisada)");
    await user.click(screen.getByTestId("salvar-regra"));
    // a v2 aparece, pendente, com selo de versão; a v1 saiu da lista (arquivada)
    const nova = cartao("Regra assinada por todos (revisada)");
    expect(within(nova).getByTestId("selo-versao").textContent).toBe("v2");
    expect(within(nova).getByTestId("status-regra").textContent).toBe("Faltam 4");
    expect(screen.queryByText("Regra assinada por todos")).toBeNull();
  });

  it("regra sem assinaturas pode ser editada e arquivada; 'Mostrar arquivadas' traz de volta", async () => {
    window.localStorage.clear();
    saveAttendants([ana]);
    saveRules([regra(20, { title: "Sem assinaturas" })]);
    saveRuleSignatures([]);
    const user = userEvent.setup();
    abrir();
    const c = cartao("Sem assinaturas");
    expect(within(c).getByRole("button", { name: "Editar" })).toBeTruthy();
    await user.click(within(c).getByRole("button", { name: "Arquivar" }));
    expect(screen.queryByText("Sem assinaturas")).toBeNull();
    await user.click(screen.getByRole("switch", { name: "Mostrar arquivadas" }));
    expect(within(cartao("Sem assinaturas")).getByTestId("selo-arquivada")).toBeTruthy();
  });

  it("nova regra: valida e cadastra com o login de quem criou", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByTestId("nova-regra"));
    await user.click(screen.getByTestId("salvar-regra")); // vazio: não cadastra
    expect(screen.queryByText("Regra nova de teste")).toBeNull();
    await user.type(screen.getByLabelText(/Título/), "Regra nova de teste");
    await user.type(screen.getByLabelText(/Descrição/), "Descrição da regra nova");
    await user.click(screen.getByTestId("salvar-regra"));
    const c = cartao("Regra nova de teste");
    expect(within(c).getByTestId("status-regra").textContent).toBe("Faltam 4");
  });
});
