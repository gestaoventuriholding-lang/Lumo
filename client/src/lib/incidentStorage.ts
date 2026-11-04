import { KEYS, readJSON, writeJSON } from "@/lib/cloudStore";
import { newId } from "@/lib/ids";
import type { Attendant } from "@/types/attendant";
import {
  INCIDENT_DESCRIPTION_MAX,
  INCIDENT_PROTOCOL_MAX,
  type Incident,
  type IncidentInput,
} from "@/types/incident";

export function loadIncidents(): Incident[] {
  try {
    return readJSON<Incident[]>(KEYS.incidents) ?? [];
  } catch {
    return [];
  }
}

export function saveIncidents(incidents: Incident[]): void {
  writeJSON(KEYS.incidents, incidents);
}

/** Erro em português para o formulário, ou null se estiver tudo certo */
export function validateIncidentInput(input: Partial<IncidentInput>): string | null {
  if (!input.type) return "Escolha o tipo da ocorrência.";
  if (!input.occurredOn) return "Informe a data da ocorrência.";
  if (!input.channel) return "Escolha o canal: Ligação ou WhatsApp.";
  if (!input.attendantId) return "Escolha o agente envolvido.";
  const protocol = (input.protocol ?? "").trim();
  if (!protocol) return "Informe o protocolo do atendimento. Com ele a equipe acha a conversa ou a gravação.";
  if (protocol.length > INCIDENT_PROTOCOL_MAX) {
    return `O protocolo aceita até ${INCIDENT_PROTOCOL_MAX} caracteres.`;
  }
  const description = (input.description ?? "").trim();
  if (!description) return "Conte em poucas palavras o que aconteceu.";
  if (description.length > INCIDENT_DESCRIPTION_MAX) {
    return `O texto aceita até ${INCIDENT_DESCRIPTION_MAX} caracteres. Resuma o que aconteceu.`;
  }
  if (!input.severity) return "Escolha a gravidade.";
  if (!input.status) return "Escolha a situação.";
  if (input.status === "resolved" && !(input.actionTaken ?? "").trim()) {
    return "Para marcar como resolvida, descreva a ação tomada.";
  }
  return null;
}

/**
 * Aviso de LGPD: o texto parece ter CPF ou e-mail do paciente. Só avisa, não bloqueia,
 * porque um protocolo numérico longo também pode parecer um CPF.
 */
export function looksLikePersonalData(text: string): boolean {
  const cpf = /(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/;
  const email = /[^\s@]+@[^\s@]+\.[^\s@]+/;
  return cpf.test(text) || email.test(text);
}

function resolvedAtFor(status: IncidentInput["status"], previous?: Incident): string | undefined {
  if (status !== "resolved") return undefined;
  return previous?.resolvedAt ?? new Date().toISOString();
}

export function createIncident(input: IncidentInput, attendants: Attendant[]): Incident {
  const attendant = attendants.find((a) => a.id === input.attendantId);
  const now = new Date().toISOString();
  return {
    id: newId(),
    type: input.type,
    occurredOn: input.occurredOn,
    channel: input.channel,
    attendantId: input.attendantId,
    attendantName: attendant?.name ?? "Colaborador",
    protocol: input.protocol.trim(),
    description: input.description.trim(),
    severity: input.severity,
    status: input.status,
    actionTaken: input.actionTaken.trim(),
    resolvedAt: resolvedAtFor(input.status),
    createdAt: now,
    updatedAt: now,
  };
}

export function applyIncidentUpdate(
  incident: Incident,
  input: IncidentInput,
  attendants: Attendant[]
): Incident {
  const attendant = attendants.find((a) => a.id === input.attendantId);
  return {
    ...incident,
    type: input.type,
    occurredOn: input.occurredOn,
    channel: input.channel,
    // 0 = não mudou o agente (ex.: a pessoa foi excluída depois do registro)
    attendantId: input.attendantId || incident.attendantId,
    attendantName: attendant?.name ?? incident.attendantName,
    protocol: input.protocol.trim(),
    description: input.description.trim(),
    severity: input.severity,
    status: input.status,
    actionTaken: input.actionTaken.trim(),
    resolvedAt: resolvedAtFor(input.status, incident),
    updatedAt: new Date().toISOString(),
  };
}
