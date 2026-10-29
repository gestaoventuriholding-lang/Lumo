import type { AttendanceChannel } from "./goals";

export interface DailyPerformanceRecord {
  id: number;
  attendantId: number;
  attendantName: string;
  date: string;
  channel: AttendanceChannel;
  attendancesCount: number;
  averageTimeMinutes: number;
  /** Só em totais de período vindos de relatório (não gravado): quantos dias úteis o total cobre */
  periodDays?: number;
  createdAt: string;
  updatedAt: string;
}

export type DailyPerformanceInput = Omit<
  DailyPerformanceRecord,
  "id" | "attendantName" | "createdAt" | "updatedAt"
>;
