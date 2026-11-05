import type { AttendanceChannel, GoalStatus } from "./goals";

/** Indicadores do relatório que podem ter limite. Os três primeiros são porcentagens (0 a 100); o último é em horas */
export type ProductivityLimitMetric =
  | "pause_unproductive_percent"
  | "pause_percent"
  | "occupancy_min"
  /** Horas de login por dia acima das quais o dia é desconsiderado (padrão 12) */
  | "login_max_hours";

export interface ProductivityLimit {
  id: number;
  metric: ProductivityLimitMetric;
  /** Máximo permitido (pausas, login) ou mínimo esperado (ocupação): em %, ou em horas para login_max_hours */
  value: number;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

/** Produtividade de um colaborador em um período (relatório por dia = período de 1 dia) */
export interface ProductivityRecord {
  id: number;
  attendantId: number;
  attendantName: string;
  periodStart: string;
  periodEnd: string;
  channel: AttendanceChannel;
  inboundCount?: number;
  outboundCount?: number;
  attendancesCount: number;
  talkSeconds?: number;
  tmaSeconds?: number;
  loginSeconds?: number;
  pauseSeconds?: number;
  pausePercent?: number;
  pauseLegalSeconds?: number;
  pauseProductiveSeconds?: number;
  pauseUnproductiveSeconds?: number;
  occupancyTo1?: number;
  occupancyTo2?: number;
  occupancyTo3?: number;
  occupancyTo4?: number;
  perHour?: number;
  reportCode?: string;
  sourceFile?: string;
  createdAt: string;
  updatedAt: string;
}
