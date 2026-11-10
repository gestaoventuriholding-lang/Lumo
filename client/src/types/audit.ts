/** Auditoria de atendimento. Não guarda conversa nem áudio: só o protocolo (LGPD). */
export type AuditResult = "atende" | "parcial" | "nao_atende" | "nao_aplica";
export type AuditChannel = "Ligação" | "WhatsApp";
export type AuditFuncao = "Atendente" | "Confirmação de agenda";

export const AUDIT_NOTE_MAX = 400;
export const AUDIT_GENERAL_NOTE_MAX = 1000;
export const AUDIT_FEEDBACK_MAX = 2000;
export const AUDIT_ITEM_TITLE_MAX = 160;
export const AUDIT_ITEM_HINT_MAX = 400;
export const AUDIT_CHECKLIST_NAME_MAX = 80;

export interface AuditChecklist {
  id: number;
  name: string;
  funcao: AuditFuncao;
  /** 1 = original. Checklist já usado em auditoria não muda: cria-se a versão seguinte. */
  version: number;
  previousId?: number;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface AuditItem {
  id: number;
  checklistId: number;
  position: number;
  title: string;
  hint: string;
  weight: number;
  /** "Não atende" neste critério zera a nota */
  eliminatory: boolean;
  active: boolean;
}

export interface AuditAnswer {
  itemId: number;
  result: AuditResult;
  note: string;
}

export interface Audit {
  id: number;
  attendantId: number;
  checklistId: number;
  channel: AuditChannel;
  /** AAAA-MM-DD do atendimento */
  attendedOn: string;
  protocol: string;
  answers: AuditAnswer[];
  /** Calculada pelo banco; nula se tudo foi "Não se aplica" */
  score?: number;
  eliminated: boolean;
  generalNote: string;
  feedback: string;
  /** Dia em que o feedback foi dado ao agente */
  feedbackGivenOn?: string;
  ackMode?: "agente" | "supervisora";
  ackAt?: string;
  auditorEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditSettings {
  id: 1;
  minScore: number;
  monthlyTarget: number;
}

export const DEFAULT_AUDIT_SETTINGS: AuditSettings = { id: 1, minScore: 85, monthlyTarget: 4 };
