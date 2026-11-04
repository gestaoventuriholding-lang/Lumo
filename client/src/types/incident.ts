export type IncidentType = "complaint" | "scheduling_error" | "incorrect_scheduling";

export type IncidentChannel = "Ligação" | "WhatsApp";

export type IncidentSeverity = "low" | "medium" | "high";

/** aberta → em tratamento → resolvida */
export type IncidentStatus = "open" | "in_progress" | "resolved";

/**
 * Ocorrência de atendimento. Guarda o protocolo (o "elo" com a Escallo) e nunca nome
 * nem CPF do paciente, para não manter dado pessoal (LGPD).
 */
export interface Incident {
  id: number;
  type: IncidentType;
  /** Data em que a ocorrência aconteceu (AAAA-MM-DD) */
  occurredOn: string;
  channel: IncidentChannel;
  attendantId?: number;
  /** Cópia do nome no momento do registro: o histórico continua certo se a pessoa for excluída */
  attendantName: string;
  protocol: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  /** Ação tomada; obrigatória para marcar como resolvida */
  actionTaken: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentInput {
  type: IncidentType;
  occurredOn: string;
  channel: IncidentChannel;
  attendantId: number;
  protocol: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  actionTaken: string;
}

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  complaint: "Reclamação",
  scheduling_error: "Erro de agendamento",
  incorrect_scheduling: "Agendamento incorreto",
};

export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  open: "Aberta",
  in_progress: "Em tratamento",
  resolved: "Resolvida",
};

export const INCIDENT_PROTOCOL_MAX = 60;
export const INCIDENT_DESCRIPTION_MAX = 600;
