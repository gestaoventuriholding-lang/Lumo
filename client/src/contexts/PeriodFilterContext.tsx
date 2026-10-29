import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  type DashboardPeriod,
  type DateRange,
  getMonthString,
  resolveDateRange,
} from "@/lib/dateRangeFilter";
import { getLocalDateString } from "@/lib/performanceStorage";
import {
  loadPeriodFilterState,
  savePeriodFilterState,
  type PeriodFilterState,
} from "@/lib/periodFilterStorage";
import { useLumoData } from "@/contexts/LumoDataContext";

interface PeriodFilterContextValue {
  period: DashboardPeriod;
  selectedDay: string;
  selectedWeek: string;
  selectedMonth: string;
  drillDownDay: string;
  dateRange: DateRange;
  setPeriod: (period: DashboardPeriod) => void;
  setSelectedDay: (day: string) => void;
  setSelectedWeek: (week: string) => void;
  setSelectedMonth: (month: string) => void;
  setDrillDownDay: (day: string) => void;
}

const PeriodFilterContext = createContext<PeriodFilterContextValue | null>(null);

function persist(state: PeriodFilterState) {
  savePeriodFilterState(state);
}

export function PeriodFilterProvider({ children }: { children: ReactNode }) {
  const { performanceRecords } = useLumoData();
  const [state, setState] = useState<PeriodFilterState>(() => loadPeriodFilterState());
  const syncedLatestDay = useRef(false);

  const periodValue =
    state.period === "day"
      ? state.selectedDay
      : state.period === "week"
        ? state.selectedWeek
        : state.selectedMonth;

  const dateRange = useMemo(
    () => resolveDateRange(state.period, periodValue),
    [state.period, periodValue]
  );

  useEffect(() => {
    if (syncedLatestDay.current || performanceRecords.length === 0) return;

    const today = getLocalDateString();
    const hasToday = performanceRecords.some((record) => record.date === today);

    if (!hasToday) {
      const latestDate = [...performanceRecords]
        .sort((a, b) => b.date.localeCompare(a.date))[0]?.date;
      if (latestDate) {
        setState((prev) => {
          const next = {
            ...prev,
            selectedDay: latestDate,
            selectedWeek: latestDate,
            selectedMonth: latestDate.slice(0, 7),
          };
          persist(next);
          return next;
        });
      }
    }

    syncedLatestDay.current = true;
  }, [performanceRecords]);

  useEffect(() => {
    persist(state);
  }, [state]);

  const setPeriod = useCallback((period: DashboardPeriod) => {
    setState((prev) => {
      const today = getLocalDateString();
      const next: PeriodFilterState = {
        ...prev,
        period,
        drillDownDay: period === "day" ? "" : prev.drillDownDay,
      };
      if (period === "day" && !prev.selectedDay) {
        next.selectedDay = today;
      }
      return next;
    });
  }, []);

  const setSelectedDay = useCallback((selectedDay: string) => {
    setState((prev) => ({ ...prev, selectedDay, drillDownDay: "" }));
  }, []);

  const setSelectedWeek = useCallback((selectedWeek: string) => {
    setState((prev) => ({ ...prev, selectedWeek, drillDownDay: "" }));
  }, []);

  const setSelectedMonth = useCallback((selectedMonth: string) => {
    setState((prev) => ({ ...prev, selectedMonth, drillDownDay: "" }));
  }, []);

  const setDrillDownDay = useCallback((drillDownDay: string) => {
    setState((prev) => ({ ...prev, drillDownDay }));
  }, []);

  const value = useMemo(
    () => ({
      period: state.period,
      selectedDay: state.selectedDay,
      selectedWeek: state.selectedWeek,
      selectedMonth: state.selectedMonth,
      drillDownDay: state.drillDownDay,
      dateRange,
      setPeriod,
      setSelectedDay,
      setSelectedWeek,
      setSelectedMonth,
      setDrillDownDay,
    }),
    [
      state,
      dateRange,
      setPeriod,
      setSelectedDay,
      setSelectedWeek,
      setSelectedMonth,
      setDrillDownDay,
    ]
  );

  return (
    <PeriodFilterContext.Provider value={value}>{children}</PeriodFilterContext.Provider>
  );
}

export function usePeriodFilter() {
  const context = useContext(PeriodFilterContext);
  if (!context) {
    throw new Error("usePeriodFilter must be used within PeriodFilterProvider");
  }
  return context;
}

export function usePeriodFilterOptional() {
  return useContext(PeriodFilterContext);
}
