import type { AttendanceChannel } from "./goals";

/** Canal de UM registro de desempenho (cada registro é sempre de um canal só) */
export type AttendantRecordChannel = Extract<AttendanceChannel, "Ligação" | "WhatsApp">;

/** Texto do canal de quem atende nos dois */
export const CANAL_LIGACAO_E_WHATSAPP = "Ligação e WhatsApp" as const;

/** Canal de atendimento do colaborador (cadastro): um dos canais ou os dois */
export type AttendantServiceChannel = AttendantRecordChannel | typeof CANAL_LIGACAO_E_WHATSAPP;

export interface Attendant {
  id: number;
  name: string;
  role: string;
  /** Canal de atendimento: Ligação, WhatsApp ou Ligação e WhatsApp */
  serviceChannel: AttendantServiceChannel;
  workingHours: string;
  /** Início da jornada (HH:mm), ex.: 12:40 */
  jornadaStart: string;
  /** Fim da jornada (HH:mm), ex.: 19:00 */
  jornadaEnd: string;
  observation: string;
  registrationDate: string;
  /** Código do agente na Escallo (vazio = ainda não vinculado). Liga o relatório da Escallo a este colaborador. */
  escalloCodigo?: number | null;
  /** Último dia trabalhado (AAAA-MM-DD). Vazio = colaborador ativo. Dados até esse dia (inclusive) continuam valendo. */
  terminatedOn?: string | null;
}

/** Carga horária cadastrada em Configurações (ex.: 6h20, 12x36) */
export interface WorkingHoursOption {
  id: number;
  label: string;
  createdAt: string;
}

export type AttendantInput = Omit<Attendant, "id" | "registrationDate">;
