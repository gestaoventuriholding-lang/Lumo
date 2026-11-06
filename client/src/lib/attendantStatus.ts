// Ellos: situação do colaborador (ativo ou desligado) e canais de atendimento.
// "Desligado" = tem data de desligamento, que é o ÚLTIMO DIA TRABALHADO: esse dia ainda conta; a partir do dia seguinte, não.
import { CANAL_LIGACAO_E_WHATSAPP, type Attendant, type AttendantRecordChannel } from "@/types/attendant";

export function isTerminated(attendant: Pick<Attendant, "terminatedOn">): boolean {
  return Boolean(attendant.terminatedOn);
}

/** Pode trabalhar nesse dia (AAAA-MM-DD)? Ativo sempre; desligado até o último dia trabalhado, inclusive. */
export function isActiveOn(attendant: Pick<Attendant, "terminatedOn">, date: string): boolean {
  return !attendant.terminatedOn || date <= attendant.terminatedOn;
}

/** Atende nesse canal? Quem tem "Ligação e WhatsApp" aparece nos dois. */
export function attendsChannel(attendant: Pick<Attendant, "serviceChannel">, channel: AttendantRecordChannel): boolean {
  return attendant.serviceChannel === channel || attendant.serviceChannel === CANAL_LIGACAO_E_WHATSAPP;
}

/** Lista para escolher colaborador em um dia: sem quem já estava desligado nessa data */
export function attendantsActiveOn<T extends Pick<Attendant, "terminatedOn">>(attendants: T[], date: string): T[] {
  return attendants.filter((a) => isActiveOn(a, date));
}

/** "Desligado em 15/10" (dia/mês do último dia trabalhado) */
export function desligadoEmTexto(terminatedOn: string): string {
  const [, mes, dia] = terminatedOn.split("-");
  return `Desligado em ${dia}/${mes}`;
}
