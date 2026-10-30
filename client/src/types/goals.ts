/**
 * Tipos para o sistema de Metas e Alertas do Lumo
 */

export type AttendanceChannel = "Ligação" | "WhatsApp" | "E-mail" | "Outros";
export type JobRole = "Atendente";
export type GoalStatus = "Ativo" | "Inativo";
export type AlertLevel = "green" | "yellow" | "red";

/**
 * Configuração de meta por tipo de atendimento
 */
export interface ProductionGoal {
  id: number;
  channel: AttendanceChannel;
  dailyTarget: number;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Configuração de meta por função
 */
export interface RoleGoal {
  id: number;
  role: JobRole;
  dailyTarget: number;
  description?: string;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Indicador de desempenho de um colaborador
 */
export interface PerformanceIndicator {
  id: number;
  attendantId: number;
  attendantName: string;
  role: JobRole;
  date: string;
  channel: AttendanceChannel;
  dailyTarget: number;
  produced: number;
  difference: number;
  percentage: number;
  alertLevel: AlertLevel;
}

/**
 * Alerta de desempenho
 */
export interface PerformanceAlert {
  id: number;
  attendantId: number;
  attendantName: string;
  role: JobRole;
  date: string;
  dailyTarget: number;
  produced: number;
  percentage: number;
  message: string;
  /** Texto curto no rodapé do alerta (padrão: "% da meta · função") */
  footer?: string;
  alertLevel: AlertLevel;
  timestamp: string;
  read: boolean;
}

/**
 * Ranking de metas
 */
export interface GoalRanking {
  position: number;
  attendantId: number;
  attendantName: string;
  role: JobRole;
  supervisor: string;
  dailyTarget: number;
  produced: number;
  percentage: number;
  alertLevel: AlertLevel;
  type: "exceeded" | "below" | "best_day" | "best_month";
}

/**
 * Estatísticas de metas
 */
export interface GoalStatistics {
  totalAttendants: number;
  attendantsAboveGoal: number;
  attendantsBelowGoal: number;
  averagePercentage: number;
  totalProduced: number;
  totalTarget: number;
  date: string;
}
