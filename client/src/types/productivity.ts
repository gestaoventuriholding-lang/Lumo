import type { AttendanceChannel } from "./goals";

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
