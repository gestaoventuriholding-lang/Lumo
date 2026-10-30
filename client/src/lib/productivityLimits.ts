import type { PerformanceAlert, AlertLevel } from "@/types/goals";
import type {
  ProductivityLimit,
  ProductivityLimitMetric,
  ProductivityRecord,
} from "@/types/productivity";

export interface LimitDefinition {
  metric: ProductivityLimitMetric;
  label: string;
  hint: string;
  /** "max" = não pode passar do limite; "min" = não pode ficar abaixo */
  direction: "max" | "min";
  /** Valor sugerido ao criar o limite (a pessoa pode mudar) */
  suggested: number;
}

export const LIMIT_DEFINITIONS: LimitDefinition[] = [
  {
    metric: "pause_unproductive_percent",
    label: "Pausa improdutiva",
    hint: "Máximo de tempo em pausa improdutiva, em % do tempo logado",
    direction: "max",
    suggested: 5,
  },
  {
    metric: "pause_percent",
    label: "Pausa total",
    hint: "Máximo de tempo em qualquer pausa, em % do tempo logado",
    direction: "max",
    suggested: 15,
  },
  {
    metric: "occupancy_min",
    label: "Ocupação mínima",
    hint: "Mínimo de ocupação esperado, em % do tempo logado",
    direction: "min",
    suggested: 70,
  },
];

export function getLimitDefinition(metric: ProductivityLimitMetric): LimitDefinition {
  return LIMIT_DEFINITIONS.find((d) => d.metric === metric) ?? LIMIT_DEFINITIONS[0];
}

/** Valor do limite ativo para o indicador, ou undefined se não houver */
export function activeLimit(
  limits: ProductivityLimit[],
  metric: ProductivityLimitMetric
): number | undefined {
  const found = limits.find((l) => l.metric === metric && l.status === "Ativo");
  return found ? found.value : undefined;
}

/** Quão perto do limite ainda é "atenção" (amarelo): 10% do próprio limite */
const NEAR_RATIO = 0.1;

/**
 * Situação de um valor frente ao limite: green = dentro, yellow = perto de estourar, red = fora.
 * Sem limite ou sem valor, não há o que avaliar (retorna undefined).
 */
export function evaluateLimit(
  direction: "max" | "min",
  value: number | undefined,
  limit: number | undefined
): AlertLevel | undefined {
  if (value == null || limit == null) return undefined;
  if (direction === "max") {
    if (value > limit) return "red";
    return value > limit * (1 - NEAR_RATIO) ? "yellow" : "green";
  }
  if (value < limit) return "red";
  return value < limit * (1 + NEAR_RATIO) ? "yellow" : "green";
}

/** Porcentagens de um registro do relatório, calculadas sobre o tempo logado */
export function recordPercents(record: ProductivityRecord): {
  pause_unproductive_percent?: number;
  pause_percent?: number;
  occupancy_min?: number;
} {
  const login = record.loginSeconds ?? 0;
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    pause_unproductive_percent:
      login > 0 && record.pauseUnproductiveSeconds != null
        ? round((record.pauseUnproductiveSeconds / login) * 100)
        : undefined,
    pause_percent:
      record.pausePercent != null
        ? round(record.pausePercent)
        : login > 0 && record.pauseSeconds != null
          ? round((record.pauseSeconds / login) * 100)
          : undefined,
    occupancy_min: record.occupancyTo1 != null ? round(record.occupancyTo1) : undefined,
  };
}

const METRIC_CODE: Record<ProductivityLimitMetric, number> = {
  pause_unproductive_percent: 1,
  pause_percent: 2,
  occupancy_min: 3,
};

function formatDate(iso: string): string {
  return iso.split("-").reverse().join("/");
}

/**
 * Alertas do relatório mais recente importado: quem passou do limite de pausa ou ficou
 * abaixo da ocupação mínima. Só gera alerta para limites ativos (nada é inventado).
 * Os ids são negativos para nunca colidir com os alertas de meta.
 */
export function buildProductivityAlerts(
  records: ProductivityRecord[],
  limits: ProductivityLimit[]
): PerformanceAlert[] {
  const activeLimits = limits.filter((l) => l.status === "Ativo");
  if (records.length === 0 || activeLimits.length === 0) return [];

  const latestEnd = records.reduce((max, r) => (r.periodEnd > max ? r.periodEnd : max), "");
  const latest = records.filter((r) => r.periodEnd === latestEnd);
  const alerts: PerformanceAlert[] = [];

  latest.forEach((record) => {
    const percents = recordPercents(record);
    activeLimits.forEach((limit) => {
      const def = getLimitDefinition(limit.metric);
      const value = percents[limit.metric];
      const level = evaluateLimit(def.direction, value, limit.value);
      if (!level || level === "green" || value == null) return;
      const period =
        record.periodStart === record.periodEnd
          ? formatDate(record.periodEnd)
          : `${formatDate(record.periodStart)} a ${formatDate(record.periodEnd)}`;
      alerts.push({
        id: -(record.id * 10 + METRIC_CODE[limit.metric]),
        attendantId: record.attendantId,
        attendantName: record.attendantName,
        role: "Atendente",
        date: record.periodEnd,
        dailyTarget: limit.value,
        produced: value,
        percentage: value,
        message:
          def.direction === "max"
            ? `${def.label}: ${value.toLocaleString("pt-BR")}% (limite ${limit.value.toLocaleString("pt-BR")}%) · ${record.channel}, ${period}.`
            : `${def.label}: ${value.toLocaleString("pt-BR")}% (mínimo ${limit.value.toLocaleString("pt-BR")}%) · ${record.channel}, ${period}.`,
        footer: def.label,
        alertLevel: level,
        timestamp: `${record.periodEnd}T12:00:00`,
        read: false,
      });
    });
  });

  const order = { red: 0, yellow: 1, green: 2 };
  return alerts.sort((a, b) => order[a.alertLevel] - order[b.alertLevel]);
}
