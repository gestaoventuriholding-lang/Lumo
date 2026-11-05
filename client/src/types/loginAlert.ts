/** open = novo; seen = o gestor já viu (continua na lista); resolved = tratado (sai do sininho) */
export type LoginAlertStatus = "open" | "seen" | "resolved";

/** Alerta de "tempo logado desconsiderado": o login do dia passou do limite e ficou fora das médias */
export interface LoginAlert {
  id: number;
  attendantId: number;
  attendantName: string;
  /** Dia do login (AAAA-MM-DD) */
  date: string;
  /** Tempo logado que veio da Escallo (ele não é gravado no relatório) */
  loginSeconds: number;
  /** Limite vigente quando o alerta foi gerado */
  limitSeconds: number;
  status: LoginAlertStatus;
  statusChangedAt?: string;
  createdAt: string;
  updatedAt: string;
}
