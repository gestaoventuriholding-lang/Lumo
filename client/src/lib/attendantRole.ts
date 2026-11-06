// Ellos: função do colaborador (Atendimento ou Confirmação de agenda), separada do canal.
// Confirmação de agenda (ex.: ligar para confirmar consultas) não é atendimento comum: fica fora de rankings, médias e metas
// de atendimento e aparece à parte. O que ela produz continua gravado e visível (histórico, lançamentos, mapa de ocupação).
import type { Attendant } from "@/types/attendant";

export const FUNCAO_ATENDIMENTO = "Atendente" as const;
export const FUNCAO_CONFIRMACAO = "Confirmação de agenda" as const;
export type Funcao = typeof FUNCAO_ATENDIMENTO | typeof FUNCAO_CONFIRMACAO;

/** Nome mostrado na tela para cada função */
export const FUNCOES: { value: Funcao; label: string }[] = [
  { value: FUNCAO_ATENDIMENTO, label: "Atendimento" },
  { value: FUNCAO_CONFIRMACAO, label: FUNCAO_CONFIRMACAO },
];

export function isConfirmacao(attendant: Pick<Attendant, "role">): boolean {
  return attendant.role === FUNCAO_CONFIRMACAO;
}

/** Tudo que não é confirmação de agenda conta como atendimento (inclui valores antigos ou vazios) */
export function isAtendimento(attendant: Pick<Attendant, "role">): boolean {
  return !isConfirmacao(attendant);
}

export interface ConjuntoPorFuncao<R extends { attendantId: number }> {
  attendants: Attendant[];
  records: R[];
}

/**
 * Separa colaboradores e registros por função, uma regra só para todas as telas:
 * `atendimento` alimenta rankings, médias, metas e contagens; `confirmacao` aparece à parte, sem meta.
 */
export function separarPorFuncao<R extends { attendantId: number }>(
  attendants: Attendant[],
  records: R[]
): { atendimento: ConjuntoPorFuncao<R>; confirmacao: ConjuntoPorFuncao<R> } {
  const confirmacaoIds = new Set(attendants.filter(isConfirmacao).map((a) => a.id));
  return {
    atendimento: {
      attendants: attendants.filter(isAtendimento),
      records: records.filter((r) => !confirmacaoIds.has(r.attendantId)),
    },
    confirmacao: {
      attendants: attendants.filter(isConfirmacao),
      records: records.filter((r) => confirmacaoIds.has(r.attendantId)),
    },
  };
}
