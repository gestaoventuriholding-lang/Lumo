// Ellos: Follow-up de orçamentos (tabela quote_followups). Sem dados do paciente: o protocolo é o elo com a Escallo.
export type FollowUpStatus = "pending" | "waiting" | "recovered" | "already_done" | "declined";
export type FollowUpArea = "laboratorio" | "imagem" | "outros";
export type DeclineReason = "price" | "insurance" | "elsewhere" | "gave_up" | "no_answer" | "not_offered" | "other";

export interface FollowUp {
  id: number;
  protocol: string;
  /** Dia do pedido de orçamento (AAAA-MM-DD) */
  date: string;
  area: FollowUpArea;
  attendantId: number | null;
  attendantName: string;
  status: FollowUpStatus;
  declineReason: DeclineReason | null;
  note: string;
  /** AAAA-MM-DD */
  nextContactOn: string | null;
  attempts: number;
  lastContactAt: string | null;
  handledBy: string;
}

/** O que a equipe preenche ao registrar um contato */
export interface FollowUpUpdate {
  status: FollowUpStatus;
  declineReason: DeclineReason | null;
  note: string;
  nextContactOn: string | null;
  /** Marcado quando houve uma nova tentativa de contato */
  countAttempt: boolean;
}

export const FOLLOW_UP_NOTE_MAX = 600;

export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  pending: "A contatar",
  waiting: "Aguardando retorno",
  recovered: "Recuperado",
  already_done: "Já tinha feito",
  declined: "Não vai fazer",
};

export const FOLLOW_UP_STATUS_HINTS: Record<FollowUpStatus, string> = {
  pending: "Ainda ninguém falou com o paciente.",
  waiting: "Houve contato (ou tentativa) e falta a resposta.",
  recovered: "Agendou ou fez o exame depois do contato.",
  already_done: "Já tinha feito antes do contato. Não entra na taxa de recuperação.",
  declined: "Encerrado sem fazer o exame. Informe o motivo.",
};

export const FOLLOW_UP_AREA_LABELS: Record<FollowUpArea, string> = {
  laboratorio: "Análises clínicas",
  imagem: "Imagem",
  outros: "Outros",
};

export const DECLINE_REASON_LABELS: Record<DeclineReason, string> = {
  price: "Preço",
  insurance: "Convênio",
  elsewhere: "Fez em outro lugar",
  gave_up: "Desistiu do exame",
  no_answer: "Sem resposta após as tentativas",
  not_offered: "Não realizamos o exame ou horário",
  other: "Outro",
};
