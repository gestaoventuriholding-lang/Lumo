import { getLocalDateString } from "@/lib/performanceStorage";
import { getMonthString, type DashboardPeriod } from "@/lib/dateRangeFilter";

export interface PeriodFilterState {
  period: DashboardPeriod;
  selectedDay: string;
  selectedWeek: string;
  selectedMonth: string;
  /** Dentro de semana/mês: vazio = visão agregada; ISO = dia específico */
  drillDownDay: string;
}

const STORAGE_KEY = "ellos-period-filter";

export function defaultPeriodFilterState(): PeriodFilterState {
  const today = getLocalDateString();
  return {
    period: "day",
    selectedDay: today,
    selectedWeek: today,
    selectedMonth: getMonthString(),
    drillDownDay: "",
  };
}

export function loadPeriodFilterState(): PeriodFilterState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPeriodFilterState();
    const parsed = JSON.parse(raw) as Partial<PeriodFilterState>;
    const defaults = defaultPeriodFilterState();
    return {
      period: parsed.period ?? defaults.period,
      selectedDay: parsed.selectedDay ?? defaults.selectedDay,
      selectedWeek: parsed.selectedWeek ?? defaults.selectedWeek,
      selectedMonth: parsed.selectedMonth ?? defaults.selectedMonth,
      drillDownDay: parsed.drillDownDay ?? "",
    };
  } catch {
    return defaultPeriodFilterState();
  }
}

export function savePeriodFilterState(state: PeriodFilterState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
