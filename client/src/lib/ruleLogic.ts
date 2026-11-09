// Ellos: regras do setor e assinaturas. Lógica pura (sem tela e sem banco), testada com dados inventados.
//
// Quem precisa assinar uma regra:
//  - quem a regra alcança (todos, só Atendimento ou só Confirmação de agenda);
//  - quem entrou depois da regra também (continua pendente até assinar);
//  - desligado só deixa de contar como pendente a partir do DIA SEGUINTE ao último dia trabalhado;
//  - quem foi desligado antes do início da vigência nem entra na conta.
// Depois da primeira assinatura o texto da regra não muda: cria-se uma nova versão (a antiga fica arquivada com as assinaturas dela).
import { newId } from "@/lib/ids";
import { FUNCAO_CONFIRMACAO, isConfirmacao } from "@/lib/attendantRole";
import type { Attendant } from "@/types/attendant";
import {
  RULE_CATEGORY_MAX,
  RULE_DESCRIPTION_MAX,
  RULE_NOTE_MAX,
  RULE_TITLE_MAX,
  type Rule,
  type RuleAppliesTo,
  type RuleInput,
  type RuleSignature,
} from "@/types/rule";

export const APLICA_A: { value: RuleAppliesTo; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "Atendente", label: "Só Atendimento" },
  { value: FUNCAO_CONFIRMACAO, label: "Só Confirmação de agenda" },
];

export function appliesToLabel(value: RuleAppliesTo): string {
  return APLICA_A.find((a) => a.value === value)?.label ?? "Todos";
}

/** A regra alcança essa pessoa (pela função dela)? */
export function ruleAppliesTo(rule: Pick<Rule, "appliesTo">, attendant: Pick<Attendant, "role">): boolean {
  if (rule.appliesTo === "all") return true;
  return rule.appliesTo === FUNCAO_CONFIRMACAO ? isConfirmacao(attendant) : !isConfirmacao(attendant);
}

/** Essa pessoa precisa assinar a regra em `today` (AAAA-MM-DD)? */
export function isRequiredToSign(
  rule: Pick<Rule, "appliesTo" | "effectiveFrom">,
  attendant: Pick<Attendant, "role" | "terminatedOn">,
  today: string
): boolean {
  if (!ruleAppliesTo(rule, attendant)) return false;
  const lastDay = attendant.terminatedOn;
  if (!lastDay) return true;
  // desligado: conta até o último dia trabalhado, e só se ainda trabalhava quando a regra passou a valer
  return lastDay >= rule.effectiveFrom && today <= lastDay;
}

export interface RuleStatus {
  /** Quem precisa assinar hoje */
  required: Attendant[];
  /** Quem precisa assinar e ainda não assinou (ordem alfabética) */
  pending: Attendant[];
  /** Quantas das pessoas obrigadas já assinaram */
  signedCount: number;
  /** Todas as assinaturas registradas nesta regra (inclusive de quem já saiu) */
  signatures: RuleSignature[];
  allSigned: boolean;
  /** "Assinada por todos", "Faltam 3" ou "Sem pessoas aplicáveis" */
  label: string;
}

export function ruleStatus(
  rule: Rule,
  attendants: Attendant[],
  signatures: RuleSignature[],
  today: string
): RuleStatus {
  const own = signatures.filter((s) => s.ruleId === rule.id);
  const signedIds = new Set(own.map((s) => s.attendantId));
  const required = attendants.filter((a) => isRequiredToSign(rule, a, today));
  const pending = required
    .filter((a) => !signedIds.has(a.id))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const signedCount = required.length - pending.length;
  const allSigned = required.length > 0 && pending.length === 0;
  const label =
    required.length === 0 ? "Sem pessoas aplicáveis" : pending.length === 0 ? "Assinada por todos" : `Faltam ${pending.length}`;
  return { required, pending, signedCount, signatures: own, allSigned, label };
}

export type RuleFilter = "todas" | "pendentes" | "assinadas";

/** Filtro da lista. Regras arquivadas só aparecem se pedido; nelas o filtro por assinatura não se aplica. */
export function filterRules(
  rules: Rule[],
  statusOf: (rule: Rule) => RuleStatus,
  filter: RuleFilter,
  showArchived: boolean,
  search = ""
): Rule[] {
  const term = search.trim().toLowerCase();
  return rules
    .filter((r) => (showArchived ? true : r.status === "active"))
    .filter((r) => !term || r.title.toLowerCase().includes(term) || (r.category ?? "").toLowerCase().includes(term))
    .filter((r) => {
      if (filter === "todas" || r.status === "archived") return true;
      const s = statusOf(r);
      return filter === "pendentes" ? s.pending.length > 0 : s.allSigned;
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return b.effectiveFrom.localeCompare(a.effectiveFrom) || b.version - a.version || a.title.localeCompare(b.title, "pt-BR");
    });
}

// ---------------------------------------------------------------- validação

const dataValida = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T12:00:00`).getTime());

/** Erro em português para o formulário, ou null se estiver tudo certo */
export function validateRuleInput(input: Partial<RuleInput>): string | null {
  const title = (input.title ?? "").trim();
  if (!title) return "Informe o título da regra.";
  if (title.length > RULE_TITLE_MAX) return `O título pode ter até ${RULE_TITLE_MAX} caracteres.`;
  const description = (input.description ?? "").trim();
  if (!description) return "Descreva a regra.";
  if (description.length > RULE_DESCRIPTION_MAX) return `A descrição pode ter até ${RULE_DESCRIPTION_MAX} caracteres.`;
  const category = (input.category ?? "").trim();
  if (category.length > RULE_CATEGORY_MAX) return `A categoria pode ter até ${RULE_CATEGORY_MAX} caracteres.`;
  if (!input.effectiveFrom || !dataValida(input.effectiveFrom)) return "Informe a data de início da vigência.";
  if (!input.appliesTo) return "Escolha a quem a regra se aplica.";
  return null;
}

/** Data da assinatura: válida e não pode ser futura */
export function validateSignedOn(signedOn: string, today: string, note = ""): string | null {
  if (!signedOn || !dataValida(signedOn)) return "Informe a data da assinatura.";
  if (signedOn > today) return "A data da assinatura não pode ser no futuro.";
  if (note.length > RULE_NOTE_MAX) return `A observação pode ter até ${RULE_NOTE_MAX} caracteres.`;
  return null;
}

// ---------------------------------------------------------------- criação e versões

function normalizar(input: RuleInput): Pick<Rule, "title" | "description" | "category" | "effectiveFrom" | "appliesTo"> {
  const category = (input.category ?? "").trim();
  return {
    title: input.title.trim(),
    description: input.description.trim(),
    category: category || undefined,
    effectiveFrom: input.effectiveFrom,
    appliesTo: input.appliesTo,
  };
}

export function createRule(input: RuleInput, createdByEmail: string, nowIso = new Date().toISOString()): Rule {
  return {
    id: newId(),
    ...normalizar(input),
    status: "active",
    version: 1,
    createdByEmail,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/** Edita uma regra AINDA SEM assinaturas. (Com assinaturas o banco recusa: use `createNewVersion`.) */
export function applyRuleUpdate(rule: Rule, input: RuleInput, nowIso = new Date().toISOString()): Rule {
  return { ...rule, ...normalizar(input), updatedAt: nowIso };
}

export function archiveRule(rule: Rule, nowIso = new Date().toISOString()): Rule {
  return { ...rule, status: "archived", archivedAt: nowIso, updatedAt: nowIso };
}

export function unarchiveRule(rule: Rule, nowIso = new Date().toISOString()): Rule {
  return { ...rule, status: "active", archivedAt: undefined, updatedAt: nowIso };
}

/** Só dá para reativar uma regra arquivada se nenhuma versão mais nova a substituiu */
export function canUnarchive(rule: Rule, rules: Rule[]): boolean {
  return rule.status === "archived" && !rules.some((r) => r.previousId === rule.id);
}

/**
 * Nova versão: a regra atual é arquivada (com as assinaturas dela) e a nova nasce sem assinaturas.
 * Devolve as duas para o chamador gravar.
 */
export function createNewVersion(
  current: Rule,
  input: RuleInput,
  createdByEmail: string,
  nowIso = new Date().toISOString()
): { archivedOld: Rule; created: Rule } {
  const archivedOld = current.status === "archived" ? current : archiveRule(current, nowIso);
  const created: Rule = {
    id: newId(),
    ...normalizar(input),
    status: "active",
    version: current.version + 1,
    previousId: current.id,
    createdByEmail,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  return { archivedOld, created };
}

/** A cadeia de versões da regra, da mais antiga para a mais nova */
export function versionChain(rules: Rule[], rule: Rule): Rule[] {
  const byId = new Map(rules.map((r) => [r.id, r]));
  const chain: Rule[] = [rule];
  const vistos = new Set<number>([rule.id]);
  let atual: Rule | undefined = rule;
  while (atual?.previousId !== undefined) {
    const anterior = byId.get(atual.previousId);
    if (!anterior || vistos.has(anterior.id)) break;
    chain.unshift(anterior);
    vistos.add(anterior.id);
    atual = anterior;
  }
  atual = rule;
  for (;;) {
    const proxima = rules.find((r) => r.previousId === atual!.id && !vistos.has(r.id));
    if (!proxima) break;
    chain.push(proxima);
    vistos.add(proxima.id);
    atual = proxima;
  }
  return chain;
}

// ---------------------------------------------------------------- assinaturas

function novaAssinatura(ruleId: number, attendantId: number, signedOn: string, note: string, nowIso: string): RuleSignature {
  return { id: newId(), ruleId, attendantId, signedOn, note: note.trim(), createdAt: nowIso, updatedAt: nowIso };
}

/**
 * "Marcar todos como assinados": cria a assinatura, com a data do treinamento, para cada pessoa pendente.
 * Quem já assinou não muda (ajustes individuais continuam valendo).
 */
export function signAllPending(
  signatures: RuleSignature[],
  rule: Pick<Rule, "id">,
  pending: Pick<Attendant, "id">[],
  signedOn: string,
  note = "",
  nowIso = new Date().toISOString()
): RuleSignature[] {
  const ja = new Set(signatures.filter((s) => s.ruleId === rule.id).map((s) => s.attendantId));
  const novas = pending.filter((a) => !ja.has(a.id)).map((a) => novaAssinatura(rule.id, a.id, signedOn, note, nowIso));
  return [...signatures, ...novas];
}

/** Marca ou ajusta a assinatura de UMA pessoa (cria se não existir; mantém o id se existir) */
export function setSignature(
  signatures: RuleSignature[],
  ruleId: number,
  attendantId: number,
  signedOn: string,
  note = "",
  nowIso = new Date().toISOString()
): RuleSignature[] {
  const existente = signatures.find((s) => s.ruleId === ruleId && s.attendantId === attendantId);
  if (!existente) return [...signatures, novaAssinatura(ruleId, attendantId, signedOn, note, nowIso)];
  return signatures.map((s) => (s === existente ? { ...s, signedOn, note: note.trim(), updatedAt: nowIso } : s));
}

export function removeSignature(signatures: RuleSignature[], id: number): RuleSignature[] {
  return signatures.filter((s) => s.id !== id);
}

/** Textos de contagem para os cabeçalhos da lista */
export function summarizeRules(rules: Rule[], statusOf: (rule: Rule) => RuleStatus) {
  const ativas = rules.filter((r) => r.status === "active");
  const statuses = ativas.map(statusOf);
  return {
    ativas: ativas.length,
    pendentes: statuses.filter((s) => s.pending.length > 0).length,
    assinadasPorTodos: statuses.filter((s) => s.allSigned).length,
    pessoasPendentes: statuses.reduce((n, s) => n + s.pending.length, 0),
  };
}
