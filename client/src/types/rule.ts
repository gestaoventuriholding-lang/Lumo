/** A quem a regra se aplica: todos, só Atendimento ou só Confirmação de agenda */
export type RuleAppliesTo = "all" | "Atendente" | "Confirmação de agenda";
export type RuleStatusValue = "active" | "archived";

export const RULE_TITLE_MAX = 120;
export const RULE_DESCRIPTION_MAX = 4000;
export const RULE_CATEGORY_MAX = 40;
export const RULE_NOTE_MAX = 200;

export interface Rule {
  id: number;
  title: string;
  description: string;
  category?: string;
  /** Início da vigência (AAAA-MM-DD) */
  effectiveFrom: string;
  appliesTo: RuleAppliesTo;
  status: RuleStatusValue;
  archivedAt?: string;
  /** Número da versão (1 = original). Texto assinado não muda: cria-se a versão seguinte. */
  version: number;
  /** Versão anterior desta regra (ela fica arquivada, com as assinaturas dela) */
  previousId?: number;
  /** E-mail de quem cadastrou (o banco preenche pelo login) */
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface RuleInput {
  title: string;
  description: string;
  category?: string;
  effectiveFrom: string;
  appliesTo: RuleAppliesTo;
}

export interface RuleSignature {
  id: number;
  ruleId: number;
  attendantId: number;
  /** Dia em que assinou (AAAA-MM-DD) */
  signedOn: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}
