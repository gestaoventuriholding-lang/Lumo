// Ellos: estado da sincronização com a Escallo (lógica pura, sem tela e sem banco).
// Lê as execuções registradas em sync_runs e decide: "Atualizado às HH:MM", e quando gerar alerta no sino.
import type { PerformanceAlert } from "@/types/goals";

export type SyncMode = "hoje" | "fechamento" | "manual" | "simulacao";
export type SyncStatus = "executando" | "ok" | "erro" | "pulado";

/** Uma execução, como a tela usa (camelCase) */
export interface SyncRun {
  id: string;
  mode: SyncMode;
  triggeredBy: "agendador" | "pessoa";
  days: string[];
  startedAt: string;
  finishedAt: string | null;
  status: SyncStatus;
  rowsInserted: number;
  rowsUpdated: number;
  rowsSkippedManual: number;
  loginBlanked: number;
  alertsCreated: number;
  unlinkedWithActivity: number;
  error: string | null;
  durationMs: number | null;
}

type Row = Record<string, unknown>;
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function runFromRow(r: Row): SyncRun {
  return {
    id: String(r.id),
    mode: r.mode as SyncMode,
    triggeredBy: r.triggered_by === "pessoa" ? "pessoa" : "agendador",
    days: Array.isArray(r.days) ? (r.days as string[]) : [],
    startedAt: String(r.started_at),
    finishedAt: r.finished_at ? String(r.finished_at) : null,
    status: r.status as SyncStatus,
    rowsInserted: n(r.rows_inserted),
    rowsUpdated: n(r.rows_updated),
    rowsSkippedManual: n(r.rows_skipped_manual),
    loginBlanked: n(r.login_blanked),
    alertsCreated: n(r.alerts_created),
    unlinkedWithActivity: n(r.unlinked_with_activity),
    error: r.error ? String(r.error) : null,
    durationMs: typeof r.duration_ms === "number" ? r.duration_ms : null,
  };
}

export const MODE_LABEL: Record<SyncMode, string> = {
  hoje: "Hoje",
  fechamento: "Fechamento do dia",
  manual: "Manual",
  simulacao: "Simulação",
};
export const STATUS_LABEL: Record<SyncStatus, string> = {
  executando: "Executando",
  ok: "Concluída",
  erro: "Erro",
  pulado: "Pulada",
};

/** Regras do alerta (combinadas com a Amanda) */
export const FALHAS_SEGUIDAS_PARA_ALERTA = 2;
export const MINUTOS_SEM_SUCESSO_PARA_ALERTA = 90;

const TIMEZONE = "America/Sao_Paulo";

/** "14:30" em horário de Brasília */
export function horaSp(iso: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}
/** "05/11" em horário de Brasília */
export function diaMesSp(iso: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, day: "2-digit", month: "2-digit" }).format(new Date(iso));
}
/** AAAA-MM-DD em horário de Brasília */
export function diaSp(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date(iso));
}

/** Só estas execuções contam para "atualizado" e para alerta: simulação não grava e "pulada" não rodou */
export function execucoesQueContam(runs: SyncRun[]): SyncRun[] {
  return runs
    .filter((r) => r.mode !== "simulacao" && (r.status === "ok" || r.status === "erro"))
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0));
}

/** A última execução que terminou bem (gravando dados) */
export function ultimoSucesso(runs: SyncRun[]): SyncRun | null {
  return execucoesQueContam(runs).find((r) => r.status === "ok") ?? null;
}

/** "Atualizado às 14:30" (hoje) ou "Atualizado em 05/11 às 14:30"; null se nunca sincronizou */
export function textoAtualizado(runs: SyncRun[], agora: Date = new Date()): string | null {
  const ok = ultimoSucesso(runs);
  if (!ok) return null;
  const quando = ok.finishedAt ?? ok.startedAt;
  return diaSp(quando) === diaSp(agora) ? `Atualizado às ${horaSp(quando)}` : `Atualizado em ${diaMesSp(quando)} às ${horaSp(quando)}`;
}

/** Horário em que o agendador deveria estar rodando: seg a sáb, das 07:00 às 19:30 (Brasília) */
export function emHorarioComercial(agora: Date): boolean {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(agora);
  const dia = partes.find((p) => p.type === "weekday")?.value;
  const h = Number(partes.find((p) => p.type === "hour")?.value) % 24;
  const m = Number(partes.find((p) => p.type === "minute")?.value);
  if (!dia || dia === "Sun") return false;
  const minutos = h * 60 + m;
  return minutos >= 7 * 60 && minutos <= 19 * 60 + 30;
}

export type AlertaSync =
  | { tipo: "falha"; desde: string; ultimoErro: string | null; ultimoSucesso: string | null }
  | { tipo: "parada"; minutos: number; ultimoSucesso: string | null };

/**
 * Quando mostrar alerta no sino:
 *  - "falha": as DUAS últimas execuções (que contam) terminaram com erro;
 *  - "parada": o agendador está ligado, é horário comercial e faz mais de 90 minutos sem sucesso.
 * Com o agendador desligado não há alerta de parada (e execuções manuais com erro seguem a regra da falha).
 */
export function avaliarSincronizacao(runs: SyncRun[], agendadorLigado: boolean, agora: Date = new Date()): AlertaSync | null {
  const contam = execucoesQueContam(runs);
  const ok = contam.find((r) => r.status === "ok") ?? null;
  const ultimas = contam.slice(0, FALHAS_SEGUIDAS_PARA_ALERTA);
  if (ultimas.length === FALHAS_SEGUIDAS_PARA_ALERTA && ultimas.every((r) => r.status === "erro")) {
    return { tipo: "falha", desde: ultimas[0].startedAt, ultimoErro: ultimas[0].error, ultimoSucesso: ok ? (ok.finishedAt ?? ok.startedAt) : null };
  }
  if (agendadorLigado && emHorarioComercial(agora)) {
    const ref = ok ? new Date(ok.finishedAt ?? ok.startedAt).getTime() : null;
    const minutos = ref === null ? null : Math.floor((agora.getTime() - ref) / 60_000);
    if (minutos !== null && minutos > MINUTOS_SEM_SUCESSO_PARA_ALERTA) {
      return { tipo: "parada", minutos, ultimoSucesso: new Date(ref as number).toISOString() };
    }
  }
  return null;
}

/** O alerta no formato do sino. O id é negativo e muda a cada novo problema, para um "descartar" não esconder o seguinte. */
export function alertaParaSino(alerta: AlertaSync | null): PerformanceAlert[] {
  if (!alerta) return [];
  const ultimo = alerta.ultimoSucesso ? `Último sucesso às ${horaSp(alerta.ultimoSucesso)}` : "Ainda sem nenhuma sincronização concluída";
  const base = {
    attendantId: 0,
    attendantName: "Sincronização com a Escallo",
    role: "Atendente" as const,
    dailyTarget: 0,
    produced: 0,
    percentage: 0,
    read: false,
    kind: "sync" as const,
  };
  if (alerta.tipo === "falha") {
    const quando = new Date(alerta.desde);
    return [{
      ...base,
      id: -2_000_000_000_000 - Math.floor(quando.getTime() / 1000),
      date: diaSp(quando),
      message: "A sincronização falhou duas vezes seguidas. Os números do dia podem estar desatualizados.",
      footer: `Falha às ${horaSp(quando)} · ${ultimo}${alerta.ultimoErro ? ` · ${alerta.ultimoErro}` : ""}`,
      alertLevel: "red",
      timestamp: quando.toISOString(),
    }];
  }
  const ref = alerta.ultimoSucesso ? new Date(alerta.ultimoSucesso) : new Date();
  return [{
    ...base,
    id: -3_000_000_000_000 - Math.floor(ref.getTime() / 1000),
    date: diaSp(ref),
    message: `A sincronização não conclui há mais de ${MINUTOS_SEM_SUCESSO_PARA_ALERTA} minutos (${alerta.minutos} min). Confira se o agendador está ligado.`,
    footer: ultimo,
    alertLevel: "yellow",
    timestamp: ref.toISOString(),
  }];
}
