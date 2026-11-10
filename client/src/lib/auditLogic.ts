// Ellos: auditoria de atendimento. Lógica pura (sem tela e sem banco), testada com dados inventados.
//
// Nota (0 a 100) = soma(peso x {Atende 1; Parcial 0,5; Não atende 0}) / soma(peso dos critérios que valeram) x 100.
// "Não se aplica" não conta e a nota é recalculada sobre o que valeu. Critério eliminatório em "Não atende" zera a nota.
// O banco calcula a mesma nota (gatilho `audits_calcula_nota`); aqui é para mostrar na tela antes de salvar.
// Checklist já usado numa auditoria não muda (peso, título, eliminatório): cria-se uma nova versão.
import { newId } from "@/lib/ids";
import { isConfirmacao } from "@/lib/attendantRole";
import type { Attendant } from "@/types/attendant";
import {
  AUDIT_CHECKLIST_NAME_MAX,
  AUDIT_FEEDBACK_MAX,
  AUDIT_GENERAL_NOTE_MAX,
  AUDIT_ITEM_HINT_MAX,
  AUDIT_ITEM_TITLE_MAX,
  AUDIT_NOTE_MAX,
  type Audit,
  type AuditAnswer,
  type AuditChannel,
  type AuditChecklist,
  type AuditFuncao,
  type AuditItem,
  type AuditResult,
  type AuditSettings,
} from "@/types/audit";

export const RESULTADOS: { value: AuditResult; label: string; short: string }[] = [
  { value: "atende", label: "Atende", short: "Atende" },
  { value: "parcial", label: "Parcial (metade)", short: "Parcial" },
  { value: "nao_atende", label: "Não atende", short: "Não atende" },
  { value: "nao_aplica", label: "Não se aplica", short: "N/A" },
];

export const CANAIS_AUDITORIA: AuditChannel[] = ["Ligação", "WhatsApp"];

export function resultLabel(result: AuditResult): string {
  return RESULTADOS.find((r) => r.value === result)?.label ?? result;
}

const FATOR: Record<AuditResult, number> = { atende: 1, parcial: 0.5, nao_atende: 0, nao_aplica: 0 };

export interface ScoreResult {
  /** 0 a 100, uma casa decimal; undefined se tudo foi "Não se aplica" */
  score?: number;
  eliminated: boolean;
  /** Soma dos pesos dos critérios que valeram */
  validWeight: number;
}

export function computeScore(answers: AuditAnswer[], items: Pick<AuditItem, "id" | "weight" | "eliminatory">[]): ScoreResult {
  const byId = new Map(items.map((i) => [i.id, i]));
  let total = 0;
  let ganho = 0;
  let eliminated = false;
  for (const a of answers) {
    const item = byId.get(a.itemId);
    if (!item) continue;
    if (item.eliminatory && a.result === "nao_atende") eliminated = true;
    if (a.result === "nao_aplica") continue;
    total += item.weight;
    ganho += item.weight * FATOR[a.result];
  }
  if (eliminated) return { score: 0, eliminated: true, validWeight: total };
  if (total === 0) return { score: undefined, eliminated: false, validWeight: 0 };
  return { score: Math.round((ganho / total) * 1000) / 10, eliminated: false, validWeight: total };
}

// ---------------------------------------------------------------- checklists

export function funcaoDe(attendant: Pick<Attendant, "role">): AuditFuncao {
  return isConfirmacao(attendant) ? "Confirmação de agenda" : "Atendente";
}

export function activeChecklist(checklists: AuditChecklist[], funcao: AuditFuncao): AuditChecklist | undefined {
  return checklists.find((c) => c.funcao === funcao && c.status === "active");
}

/** Critérios de um checklist, na ordem; `onlyActive` para uma auditoria nova */
export function itemsOf(items: AuditItem[], checklistId: number, onlyActive = false): AuditItem[] {
  return items
    .filter((i) => i.checklistId === checklistId && (!onlyActive || i.active))
    .sort((a, b) => a.position - b.position || a.id - b.id);
}

export function isChecklistUsed(audits: Pick<Audit, "checklistId">[], checklistId: number): boolean {
  return audits.some((a) => a.checklistId === checklistId);
}

export function totalWeight(items: Pick<AuditItem, "weight" | "active">[]): number {
  return items.filter((i) => i.active).reduce((n, i) => n + i.weight, 0);
}

const DEFAULTS: { title: string; hint: string; weight: number; eliminatory: boolean }[] = [
  { title: "Abertura: saudação e identificação", hint: "Saudou, identificou-se e identificou a empresa.", weight: 10, eliminatory: false },
  { title: "Confirmação do paciente", hint: "Nome completo e um dado de segurança.", weight: 15, eliminatory: false },
  { title: "Entendimento da necessidade", hint: "Ouviu, perguntou o que faltava e resumiu o pedido.", weight: 10, eliminatory: false },
  {
    title: "Informação correta",
    hint: "Exames, preparo, valores, convênio, unidades e horários. Eliminatório: informação errada que pode prejudicar o paciente.",
    weight: 20,
    eliminatory: true,
  },
  { title: "Agendamento correto no sistema", hint: "Exame, data, horário, unidade e convênio certos.", weight: 15, eliminatory: false },
  { title: "Orientação de preparo e documentos", hint: "Orientou jejum, preparo e documentos necessários.", weight: 10, eliminatory: false },
  {
    title: "Cordialidade e linguagem",
    hint: "Educação e clareza (no WhatsApp, ortografia). Eliminatório: falta de respeito.",
    weight: 10,
    eliminatory: true,
  },
  { title: "Registro: tabulação e protocolo informado", hint: "Tabulou corretamente e informou o protocolo ao paciente.", weight: 5, eliminatory: false },
  { title: "Encerramento", hint: "Perguntou se havia mais dúvidas e se despediu.", weight: 5, eliminatory: false },
  {
    title: "Sigilo dos dados do paciente",
    hint: "Eliminatório: passar dado do paciente a terceiros. Sem peso: só zera a nota quando falha.",
    weight: 0,
    eliminatory: true,
  },
];

/** Checklist sugerido (o mesmo que a migração cadastra), para quando não houver nenhum */
export function createDefaultChecklist(
  funcao: AuditFuncao = "Atendente",
  nowIso = new Date().toISOString()
): { checklist: AuditChecklist; items: AuditItem[] } {
  const checklist: AuditChecklist = {
    id: newId(),
    name: "Checklist padrão de atendimento",
    funcao,
    version: 1,
    status: "active",
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const items = DEFAULTS.map((d, index) => ({ id: newId(), checklistId: checklist.id, position: index + 1, active: true, ...d }));
  return { checklist, items };
}

/** Nova versão: copia os critérios (com ids novos), arquiva a atual e devolve as duas para gravar nesta ordem */
export function createChecklistVersion(
  current: AuditChecklist,
  currentItems: AuditItem[],
  nowIso = new Date().toISOString()
): { archivedOld: AuditChecklist; created: AuditChecklist; items: AuditItem[] } {
  const created: AuditChecklist = {
    ...current,
    id: newId(),
    version: current.version + 1,
    previousId: current.id,
    status: "active",
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const items = itemsOf(currentItems, current.id).map((i) => ({ ...i, id: newId(), checklistId: created.id }));
  return { archivedOld: { ...current, status: "archived", updatedAt: nowIso }, created, items };
}

export function validateChecklistName(name: string): string | null {
  const n = name.trim();
  if (!n) return "Informe o nome do checklist.";
  if (n.length > AUDIT_CHECKLIST_NAME_MAX) return `O nome pode ter até ${AUDIT_CHECKLIST_NAME_MAX} caracteres.`;
  return null;
}

export function validateItem(item: Pick<AuditItem, "title" | "hint" | "weight">): string | null {
  const title = item.title.trim();
  if (!title) return "Informe o nome do critério.";
  if (title.length > AUDIT_ITEM_TITLE_MAX) return `O nome do critério pode ter até ${AUDIT_ITEM_TITLE_MAX} caracteres.`;
  if (item.hint.length > AUDIT_ITEM_HINT_MAX) return `A orientação pode ter até ${AUDIT_ITEM_HINT_MAX} caracteres.`;
  if (!Number.isFinite(item.weight) || item.weight < 0 || item.weight > 1000) return "O peso deve ser um número de 0 a 1000.";
  return null;
}

export function validateSettings(s: Pick<AuditSettings, "minScore" | "monthlyTarget">): string | null {
  if (!Number.isFinite(s.minScore) || s.minScore < 0 || s.minScore > 100) return "A nota mínima deve ficar entre 0 e 100.";
  if (!Number.isInteger(s.monthlyTarget) || s.monthlyTarget < 0 || s.monthlyTarget > 100) {
    return "A meta mensal deve ser um número inteiro de 0 a 100.";
  }
  return null;
}

// ---------------------------------------------------------------- auditorias

export interface AuditInput {
  attendantId: number | undefined;
  channel: AuditChannel | "";
  attendedOn: string;
  protocol: string;
  answers: AuditAnswer[];
  generalNote: string;
  feedback: string;
}

const dataValida = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T12:00:00`).getTime());

/** Parece CPF ou e-mail no texto? (aviso de LGPD, não bloqueia) */
export function pareceDadoPessoal(texto: string): boolean {
  // CPF isolado (11 dígitos, com ou sem pontos); um protocolo de 12 dígitos não conta
  return /(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/.test(texto) || /\S+@\S+\.\S+/.test(texto);
}

export function validateAuditInput(
  input: AuditInput,
  activeItems: Pick<AuditItem, "id">[],
  audits: Pick<Audit, "id" | "protocol" | "channel">[],
  today: string,
  editingId?: number
): string | null {
  if (input.attendantId === undefined) return "Escolha o colaborador auditado.";
  if (!input.channel) return "Escolha o canal do atendimento.";
  const protocol = input.protocol.trim();
  if (!protocol) return "Informe o protocolo do atendimento.";
  if (protocol.length > 60) return "O protocolo pode ter até 60 caracteres.";
  if (!input.attendedOn || !dataValida(input.attendedOn)) return "Informe a data do atendimento.";
  if (input.attendedOn > today) return "A data do atendimento não pode ser no futuro.";
  if (audits.some((a) => a.id !== editingId && a.channel === input.channel && a.protocol.trim().toLowerCase() === protocol.toLowerCase())) {
    return "Este atendimento (protocolo e canal) já foi auditado.";
  }
  const respondidos = new Set(input.answers.map((a) => a.itemId));
  const faltam = activeItems.filter((i) => !respondidos.has(i.id)).length;
  if (faltam > 0) return faltam === 1 ? "Falta avaliar 1 critério." : `Faltam avaliar ${faltam} critérios.`;
  if (input.answers.some((a) => a.note.length > AUDIT_NOTE_MAX)) return `A observação de um critério pode ter até ${AUDIT_NOTE_MAX} caracteres.`;
  if (input.generalNote.length > AUDIT_GENERAL_NOTE_MAX) return `A observação geral pode ter até ${AUDIT_GENERAL_NOTE_MAX} caracteres.`;
  if (input.feedback.length > AUDIT_FEEDBACK_MAX) return `O feedback pode ter até ${AUDIT_FEEDBACK_MAX} caracteres.`;
  return null;
}

export function createAudit(
  input: AuditInput,
  checklist: Pick<AuditChecklist, "id">,
  items: Pick<AuditItem, "id" | "weight" | "eliminatory">[],
  auditorEmail: string,
  nowIso = new Date().toISOString()
): Audit {
  const { score, eliminated } = computeScore(input.answers, items);
  return {
    id: newId(),
    attendantId: input.attendantId!,
    checklistId: checklist.id,
    channel: input.channel as AuditChannel,
    attendedOn: input.attendedOn,
    protocol: input.protocol.trim(),
    answers: input.answers.map((a) => ({ ...a, note: a.note.trim() })),
    score,
    eliminated,
    generalNote: input.generalNote.trim(),
    feedback: input.feedback.trim(),
    auditorEmail,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/** Refaz respostas, notas e feedback de uma auditoria já salva (o checklist dela não muda) */
export function updateAudit(
  audit: Audit,
  input: AuditInput,
  items: Pick<AuditItem, "id" | "weight" | "eliminatory">[],
  nowIso = new Date().toISOString()
): Audit {
  const { score, eliminated } = computeScore(input.answers, items);
  return {
    ...audit,
    attendantId: input.attendantId!,
    channel: input.channel as AuditChannel,
    attendedOn: input.attendedOn,
    protocol: input.protocol.trim(),
    answers: input.answers.map((a) => ({ ...a, note: a.note.trim() })),
    score,
    eliminated,
    generalNote: input.generalNote.trim(),
    feedback: input.feedback.trim(),
    updatedAt: nowIso,
  };
}

/** A supervisora registra "feedback dado em [data]" (etapa 1: o agente ainda não tem login) */
export function registerFeedback(audit: Audit, givenOn: string, nowIso = new Date().toISOString()): Audit {
  return { ...audit, feedbackGivenOn: givenOn, ackMode: "supervisora", ackAt: nowIso, updatedAt: nowIso };
}

export function clearFeedbackRegistration(audit: Audit, nowIso = new Date().toISOString()): Audit {
  return { ...audit, feedbackGivenOn: undefined, ackMode: undefined, ackAt: undefined, updatedAt: nowIso };
}

export function validateFeedbackDate(givenOn: string, today: string, attendedOn: string): string | null {
  if (!givenOn || !dataValida(givenOn)) return "Informe a data em que o feedback foi dado.";
  if (givenOn > today) return "A data do feedback não pode ser no futuro.";
  if (givenOn < attendedOn) return "O feedback não pode ser anterior ao atendimento.";
  return null;
}

// ---------------------------------------------------------------- painel

export const monthKey = (isoDate: string) => isoDate.slice(0, 7);

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const nome = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

/** Meses com auditoria, do mais recente ao mais antigo (sempre inclui o mês de `today`) */
export function auditMonths(audits: Pick<Audit, "attendedOn">[], today: string): string[] {
  const set = new Set(audits.map((a) => monthKey(a.attendedOn)));
  set.add(monthKey(today));
  return Array.from(set).sort().reverse();
}

export interface AgentAuditRow {
  attendant: Attendant;
  count: number;
  /** Média das notas do mês; undefined se nenhuma auditoria teve nota */
  average?: number;
  target: number;
  /** Quantas faltam para a meta de auditorias */
  missing: number;
  belowMin: boolean;
  eliminatedCount: number;
  lastScore?: number;
}

export interface AuditPanel {
  month: string;
  rows: AgentAuditRow[];
  totalAudits: number;
  overallAverage?: number;
  belowMin: AgentAuditRow[];
  withoutAudit: AgentAuditRow[];
}

const media = (list: number[]) => (list.length ? Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10 : undefined);

/**
 * Painel do mês. Considera os colaboradores que trabalhavam no mês (desligado só sai depois do último dia trabalhado).
 * Quem tem auditoria no mês aparece mesmo desligado.
 */
export function buildAuditPanel(
  audits: Audit[],
  attendants: Attendant[],
  settings: AuditSettings,
  month: string
): AuditPanel {
  const doMes = audits.filter((a) => monthKey(a.attendedOn) === month);
  const primeiroDia = `${month}-01`;
  const rows: AgentAuditRow[] = attendants
    .filter((a) => !a.terminatedOn || a.terminatedOn >= primeiroDia || doMes.some((x) => x.attendantId === a.id))
    .map((attendant) => {
      const proprias = doMes.filter((a) => a.attendantId === attendant.id).sort((a, b) => b.attendedOn.localeCompare(a.attendedOn));
      const notas = proprias.map((a) => a.score).filter((n): n is number => n !== undefined);
      const average = media(notas);
      return {
        attendant,
        count: proprias.length,
        average,
        target: settings.monthlyTarget,
        missing: Math.max(0, settings.monthlyTarget - proprias.length),
        belowMin: average !== undefined && average < settings.minScore,
        eliminatedCount: proprias.filter((a) => a.eliminated).length,
        lastScore: notas[0],
      };
    })
    .sort((a, b) => a.attendant.name.localeCompare(b.attendant.name, "pt-BR"));
  const todasNotas = doMes.map((a) => a.score).filter((n): n is number => n !== undefined);
  return {
    month,
    rows,
    totalAudits: doMes.length,
    overallAverage: media(todasNotas),
    belowMin: rows.filter((r) => r.belowMin).sort((a, b) => (a.average ?? 0) - (b.average ?? 0)),
    withoutAudit: rows.filter((r) => r.count < r.target),
  };
}

/** Evolução mensal da nota média de um colaborador (para a ficha dele) */
export function monthlyAverages(audits: Audit[], attendantId: number): { month: string; average?: number; count: number }[] {
  const meses = new Map<string, number[]>();
  const contagem = new Map<string, number>();
  for (const a of audits.filter((x) => x.attendantId === attendantId)) {
    const k = monthKey(a.attendedOn);
    contagem.set(k, (contagem.get(k) ?? 0) + 1);
    if (a.score !== undefined) meses.set(k, [...(meses.get(k) ?? []), a.score]);
  }
  return Array.from(contagem.keys())
    .sort()
    .map((month) => ({ month, average: media(meses.get(month) ?? []), count: contagem.get(month) ?? 0 }));
}

/** Auditorias dentro do período (AAAA-MM-DD, inclusivo), para o painel de Qualidade e o relatório */
export function auditsInPeriod(audits: Audit[], start: string, end: string): Audit[] {
  return audits.filter((a) => a.attendedOn >= start && a.attendedOn <= end);
}

export function filterAudits(
  audits: Audit[],
  attendants: Pick<Attendant, "id" | "name">[],
  f: { month?: string; attendantId?: number; channel?: AuditChannel; onlyBelowMin?: boolean; search?: string },
  minScore: number
): Audit[] {
  const nomes = new Map(attendants.map((a) => [a.id, a.name.toLowerCase()]));
  const term = (f.search ?? "").trim().toLowerCase();
  return audits
    .filter((a) => !f.month || monthKey(a.attendedOn) === f.month)
    .filter((a) => f.attendantId === undefined || a.attendantId === f.attendantId)
    .filter((a) => !f.channel || a.channel === f.channel)
    .filter((a) => !f.onlyBelowMin || (a.score !== undefined && a.score < minScore))
    .filter((a) => !term || a.protocol.toLowerCase().includes(term) || (nomes.get(a.attendantId) ?? "").includes(term))
    .sort((a, b) => b.attendedOn.localeCompare(a.attendedOn) || b.createdAt.localeCompare(a.createdAt));
}
