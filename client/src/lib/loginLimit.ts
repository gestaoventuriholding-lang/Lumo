// Ellos: regra do tempo logado acima do limite (padrão 12 horas por dia). Lógica pura, sem tela e sem banco.
//
// Se o login de um colaborador num dia passa do limite, os atendimentos continuam gravados, mas o login, a pausa,
// a ocupação e as chamadas por hora daquele dia ficam VAZIOS (nos dois canais) para não entrarem nas médias,
// e um alerta é gerado para o gestor. Só vale para relatórios de UM dia; relatório de período (semana, mês) soma
// vários dias e não dá para saber qual deles passou do limite.
import type { PerformanceAlert } from "@/types/goals";
import type { LoginAlert } from "@/types/loginAlert";
import type { ProductivityLimit, ProductivityRecord } from "@/types/productivity";
import { newId } from "@/lib/ids";

export const DEFAULT_LOGIN_MAX_HOURS = 12;
export const LOGIN_ALERT_MESSAGE = "Tempo logado desconsiderado — verificar se a pessoa deslogou";

/**
 * Limite em segundos, ou null se a regra foi desligada em Configurações.
 * Sem nada cadastrado, vale o padrão de 12 horas.
 */
export function loginLimitSeconds(limits: ProductivityLimit[]): number | null {
  const found = limits.find((l) => l.metric === "login_max_hours");
  if (!found) return DEFAULT_LOGIN_MAX_HOURS * 3600;
  if (found.status !== "Ativo") return null;
  return Number.isFinite(found.value) && found.value > 0 ? Math.round(found.value * 3600) : DEFAULT_LOGIN_MAX_HOURS * 3600;
}

export function exceedsLoginLimit(loginSeconds: number | undefined | null, limitSeconds: number | null): boolean {
  return limitSeconds != null && loginSeconds != null && loginSeconds > limitSeconds;
}

/** "18h11" */
export function formatLoginDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  return `${Math.floor(totalMinutes / 60)}h${String(totalMinutes % 60).padStart(2, "0")}`;
}

/** Copia do registro sem os campos que dependem do tempo logado. Atendimentos, TMA e tempo de conversa ficam. */
export function withoutLoginFields<T extends ProductivityRecord>(record: T): T {
  return {
    ...record,
    loginSeconds: undefined,
    pauseSeconds: undefined,
    pausePercent: undefined,
    pauseLegalSeconds: undefined,
    pauseProductiveSeconds: undefined,
    pauseUnproductiveSeconds: undefined,
    occupancyTo1: undefined,
    occupancyTo2: undefined,
    occupancyTo3: undefined,
    occupancyTo4: undefined,
    perHour: undefined,
  };
}

export interface LoginRuleResult {
  records: ProductivityRecord[];
  alerts: LoginAlert[];
  /** Dias que passaram do limite nesta aplicação (inclui alertas que já existiam) */
  flagged: { attendantId: number; attendantName: string; date: string; loginSeconds: number }[];
}

/**
 * Aplica a regra. `onlyKeys` (colaborador|dia) restringe aos dias que acabaram de ser importados; sem ele, olha tudo.
 * O login do dia é o maior entre os canais (a Escallo mede o login da pessoa, igual nos dois).
 * Alerta que já existe para o colaborador e o dia é mantido como está (a situação não volta para "aberto").
 */
export function applyLoginRule(
  records: ProductivityRecord[],
  alerts: LoginAlert[],
  limit: number | null,
  options: { onlyKeys?: Set<string>; now?: string; makeId?: () => number } = {}
): LoginRuleResult {
  if (limit == null) return { records, alerts, flagged: [] };
  const now = options.now ?? new Date().toISOString();
  const makeId = options.makeId ?? newId;
  const key = (r: ProductivityRecord) => `${r.attendantId}|${r.periodStart}`;

  const loginByDay = new Map<string, { login: number; name: string; attendantId: number; date: string }>();
  for (const r of records) {
    if (r.periodStart !== r.periodEnd || r.loginSeconds == null) continue;
    const k = key(r);
    if (options.onlyKeys && !options.onlyKeys.has(k)) continue;
    const current = loginByDay.get(k);
    if (!current || r.loginSeconds > current.login) {
      loginByDay.set(k, { login: r.loginSeconds, name: r.attendantName, attendantId: r.attendantId, date: r.periodStart });
    }
  }

  const over = new Map([...loginByDay].filter(([, v]) => exceedsLoginLimit(v.login, limit)));
  if (over.size === 0) return { records, alerts, flagged: [] };

  const nextRecords = records.map((r) => (r.periodStart === r.periodEnd && over.has(key(r)) ? withoutLoginFields(r) : r));
  const nextAlerts = [...alerts];
  const flagged: LoginRuleResult["flagged"] = [];
  for (const [, v] of over) {
    flagged.push({ attendantId: v.attendantId, attendantName: v.name, date: v.date, loginSeconds: v.login });
    if (!nextAlerts.some((a) => a.attendantId === v.attendantId && a.date === v.date)) {
      nextAlerts.push({
        id: makeId(),
        attendantId: v.attendantId,
        attendantName: v.name,
        date: v.date,
        loginSeconds: v.login,
        limitSeconds: limit,
        status: "open",
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return { records: nextRecords, alerts: nextAlerts, flagged };
}

function formatDate(iso: string): string {
  return iso.split("-").reverse().join("/");
}

/** Alertas do sininho a partir dos alertas de login que ainda não foram resolvidos (os mais recentes primeiro) */
export function buildLoginAlerts(alerts: LoginAlert[]): PerformanceAlert[] {
  return alerts
    .filter((a) => a.status !== "resolved")
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.attendantName.localeCompare(b.attendantName, "pt-BR")))
    .map((a) => ({
      // negativo, para nunca colidir com os alertas de meta
      id: -a.id,
      attendantId: a.attendantId,
      attendantName: a.attendantName,
      role: "Atendente",
      date: a.date,
      dailyTarget: Math.round(a.limitSeconds / 3600),
      produced: a.loginSeconds,
      percentage: 0,
      message: LOGIN_ALERT_MESSAGE,
      footer: `${formatDate(a.date)} · tempo na Escallo: ${formatLoginDuration(a.loginSeconds)} (limite ${formatLoginDuration(a.limitSeconds)})`,
      alertLevel: "yellow",
      timestamp: `${a.date}T12:00:00`,
      read: a.status === "seen",
      kind: "login_excess",
      sharedAlertId: a.id,
      sharedStatus: a.status === "seen" ? "seen" : "open",
    }));
}
