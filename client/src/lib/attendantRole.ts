// Ellos: função do colaborador (Atendimento, Confirmação de agenda ou Triagem), separada do canal.
// Confirmação de agenda (ex.: ligar para confirmar consultas) não é atendimento comum: fica fora de rankings, médias e metas
// de atendimento e aparece à parte. O que ela produz continua gravado e visível (histórico, lançamentos, mapa de ocupação).
import type { Attendant } from "@/types/attendant";

export const FUNCAO_ATENDIMENTO = "Atendente" as const;
export const FUNCAO_CONFIRMACAO = "Confirmação de agenda" as const;
/** Triagem (gestão): recebe o paciente e transfere para o atendimento. O que ela faz fica gravado, mas NÃO conta como atendimento. */
export const FUNCAO_TRIAGEM = "Triagem" as const;
export type Funcao = typeof FUNCAO_ATENDIMENTO | typeof FUNCAO_CONFIRMACAO | typeof FUNCAO_TRIAGEM;

/** Nome mostrado na tela para cada função */
export const FUNCOES: { value: Funcao; label: string }[] = [
  { value: FUNCAO_ATENDIMENTO, label: "Atendimento" },
  { value: FUNCAO_CONFIRMACAO, label: FUNCAO_CONFIRMACAO },
  { value: FUNCAO_TRIAGEM, label: "Triagem (gestão)" },
];

export function isConfirmacao(attendant: Pick<Attendant, "role">): boolean {
  return attendant.role === FUNCAO_CONFIRMACAO;
}

export function isTriagem(attendant: Pick<Attendant, "role">): boolean {
  return attendant.role === FUNCAO_TRIAGEM;
}

/** Tudo que não é confirmação de agenda nem triagem conta como atendimento (inclui valores antigos ou vazios) */
export function isAtendimento(attendant: Pick<Attendant, "role">): boolean {
  return !isConfirmacao(attendant) && !isTriagem(attendant);
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
): { atendimento: ConjuntoPorFuncao<R>; confirmacao: ConjuntoPorFuncao<R>; triagem: ConjuntoPorFuncao<R> } {
  const confirmacaoIds = new Set(attendants.filter(isConfirmacao).map((a) => a.id));
  const triagemIds = new Set(attendants.filter(isTriagem).map((a) => a.id));
  return {
    atendimento: {
      attendants: attendants.filter(isAtendimento),
      records: records.filter((r) => !confirmacaoIds.has(r.attendantId) && !triagemIds.has(r.attendantId)),
    },
    triagem: {
      attendants: attendants.filter(isTriagem),
      records: records.filter((r) => triagemIds.has(r.attendantId)),
    },
    confirmacao: {
      attendants: attendants.filter(isConfirmacao),
      records: records.filter((r) => confirmacaoIds.has(r.attendantId)),
    },
  };
}
