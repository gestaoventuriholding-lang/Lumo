// Ellos: contas e regras da tela de Follow-up (sem rede e sem tela).
import type { DeclineReason, FollowUp, FollowUpArea, FollowUpStatus, FollowUpUpdate } from "@/types/followUp";
import { FOLLOW_UP_NOTE_MAX } from "@/types/followUp";

export interface ResumoFollowUp {
  total: number;
  pending: number;
  waiting: number;
  recovered: number;
  alreadyDone: number;
  declined: number;
  /** Recuperados sobre quem precisava de resgate (todos menos os que já tinham feito). Null sem base. */
  recoveryRate: number | null;
  /** Retornos marcados para hoje ou antes */
  dueReturns: number;
}

export const retornoVencido = (f: FollowUp, hoje: string) => f.status === "waiting" && f.nextContactOn !== null && f.nextContactOn <= hoje;

export function resumirFollowUps(lista: FollowUp[], hoje: string): ResumoFollowUp {
  const de = (s: FollowUpStatus) => lista.filter((f) => f.status === s).length;
  const recovered = de("recovered");
  const alreadyDone = de("already_done");
  const base = lista.length - alreadyDone;
  return {
    total: lista.length,
    pending: de("pending"),
    waiting: de("waiting"),
    recovered,
    alreadyDone,
    declined: de("declined"),
    recoveryRate: base > 0 ? Math.round((recovered / base) * 100) : null,
    dueReturns: lista.filter((f) => retornoVencido(f, hoje)).length,
  };
}

/** Motivos de quem não vai fazer, do mais frequente para o menos */
export function motivosDePerda(lista: FollowUp[]): { motivo: DeclineReason; quantidade: number }[] {
  const contagem = new Map<DeclineReason, number>();
  for (const f of lista) if (f.status === "declined" && f.declineReason) contagem.set(f.declineReason, (contagem.get(f.declineReason) ?? 0) + 1);
  return [...contagem].map(([motivo, quantidade]) => ({ motivo, quantidade })).sort((a, b) => b.quantidade - a.quantidade);
}

export interface FiltroFollowUp {
  status: FollowUpStatus | "all";
  area: FollowUpArea | "all";
  /** nome de quem fez o orçamento, ou "all" */
  attendant: string;
  search: string;
}

/**
 * Filtra e ordena. "Aguardando retorno" mostra primeiro o retorno mais antigo (o mais atrasado);
 * nas outras listas vem primeiro o orçamento mais recente, que é o mais fácil de resgatar.
 */
export function filtrarFollowUps(lista: FollowUp[], filtro: FiltroFollowUp): FollowUp[] {
  const termo = filtro.search.trim().toLowerCase();
  return lista
    .filter((f) => filtro.status === "all" || f.status === filtro.status)
    .filter((f) => filtro.area === "all" || f.area === filtro.area)
    .filter((f) => filtro.attendant === "all" || f.attendantName === filtro.attendant)
    .filter((f) => !termo || f.protocol.toLowerCase().includes(termo))
    .sort((a, b) => {
      if (filtro.status === "waiting") {
        const porRetorno = (a.nextContactOn ?? "9999").localeCompare(b.nextContactOn ?? "9999");
        if (porRetorno !== 0) return porRetorno;
      }
      return b.date.localeCompare(a.date) || b.id - a.id;
    });
}

export function diasDesde(data: string, hoje: string): number {
  return Math.max(0, Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${data}T12:00:00Z`)) / 86_400_000));
}

/** Mensagem do que falta, ou null se pode salvar */
export function validarContato(u: FollowUpUpdate, hoje: string): string | null {
  if (u.status === "declined" && !u.declineReason) return "Escolha o motivo de o paciente não fazer o exame.";
  if (u.status === "waiting" && u.nextContactOn && u.nextContactOn < hoje) return "O próximo contato precisa ser hoje ou uma data futura.";
  if (u.note.length > FOLLOW_UP_NOTE_MAX) return `A anotação passa de ${FOLLOW_UP_NOTE_MAX} caracteres.`;
  return null;
}

/** Aplica o registro de um contato: o motivo só vale para "não vai fazer" e o próximo contato só para "aguardando" */
export function aplicarContato(atual: FollowUp, u: FollowUpUpdate, quem: string, agora: Date): FollowUp {
  return {
    ...atual,
    status: u.status,
    declineReason: u.status === "declined" ? u.declineReason : null,
    note: u.note.trim(),
    nextContactOn: u.status === "waiting" ? u.nextContactOn : null,
    attempts: atual.attempts + (u.countAttempt ? 1 : 0),
    lastContactAt: u.countAttempt ? agora.toISOString() : atual.lastContactAt,
    handledBy: quem.slice(0, 120),
  };
}
