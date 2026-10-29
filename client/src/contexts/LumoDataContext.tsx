import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Attendant, AttendantInput } from "@/types/attendant";
import type { Absence, AbsenceInput, AbsenceUpdateInput } from "@/types/absence";
import type {
  CalendarEvent,
  CalendarEventInput,
  CalendarEventUpdateInput,
} from "@/types/calendarEvent";
import type { ProductionGoal, RoleGoal, PerformanceIndicator } from "@/types/goals";
import type { DailyPerformanceRecord } from "@/types/performance";
import { loadAbsences, saveAbsences, createAbsence } from "@/lib/absenceStorage";
import {
  createCalendarEvent,
  loadCalendarEvents,
  saveCalendarEvents,
} from "@/lib/calendarStorage";
import {
  loadAttendants,
  saveAttendants,
  createAttendant,
} from "@/lib/attendantsStorage";
import { loadPerformanceRecords, savePerformanceRecords } from "@/lib/performanceStorage";
import { loadProductivityRecords, saveProductivityRecords } from "@/lib/productivityStorage";
import {
  executeProductivityImport,
  type ProductivityImportOptions,
  type ProductivityImportResult,
} from "@/lib/productivityImport";
import type { ProductivityReport } from "@/lib/reportParser";
import type { ProductivityRecord } from "@/types/productivity";
import {
  executePerformanceImport,
  type ImportBatchOptions,
  type ImportBatchResult,
  type ImportPlan,
} from "@/lib/spreadsheetImport";
import { appendImportLog } from "@/lib/importLogStorage";
import {
  loadProductionGoals,
  loadRoleGoals,
  saveProductionGoals,
  saveRoleGoals,
} from "@/lib/goalsStorage";
import {
  recordsToIndicators,
  todayRange,
} from "@/lib/performanceMetrics";

interface LumoDataContextValue {
  attendants: Attendant[];
  performanceRecords: DailyPerformanceRecord[];
  productivityRecords: ProductivityRecord[];
  absences: Absence[];
  calendarEvents: CalendarEvent[];
  productionGoals: ProductionGoal[];
  roleGoals: RoleGoal[];

  addAttendant: (input: AttendantInput) => Attendant;
  updateAttendant: (id: number, input: AttendantInput) => void;
  removeAttendant: (id: number) => void;
  removeAttendants: (ids: number[]) => void;

  addAbsence: (input: AbsenceInput) => Absence;
  updateAbsence: (id: number, input: AbsenceUpdateInput) => void;
  updateAbsenceStatus: (id: number, status: Absence["status"]) => void;
  removeAbsence: (id: number) => void;

  addCalendarEvent: (input: CalendarEventInput) => CalendarEvent;
  updateCalendarEvent: (id: number, input: CalendarEventUpdateInput) => void;
  removeCalendarEvent: (id: number) => void;

  addPerformanceRecord: (record: DailyPerformanceRecord) => void;
  updatePerformanceRecord: (id: number, data: Partial<DailyPerformanceRecord>) => void;
  removePerformanceRecord: (id: number) => void;
  importPerformance: (
    plan: ImportPlan,
    options: ImportBatchOptions,
    meta?: { fileName?: string }
  ) => ImportBatchResult;

  importProductivityReport: (
    report: ProductivityReport,
    options: ProductivityImportOptions
  ) => ProductivityImportResult;

  setProductionGoals: (goals: ProductionGoal[]) => void;
  setRoleGoals: (goals: RoleGoal[]) => void;

  todayIndicators: PerformanceIndicator[];
}

const LumoDataContext = createContext<LumoDataContextValue | null>(null);

export function LumoDataProvider({ children }: { children: ReactNode }) {
  const [attendants, setAttendantsState] = useState<Attendant[]>(() => loadAttendants());
  const [performanceRecords, setPerformanceRecordsState] = useState<DailyPerformanceRecord[]>(() =>
    loadPerformanceRecords()
  );
  const [productivityRecords, setProductivityRecordsState] = useState<ProductivityRecord[]>(() =>
    loadProductivityRecords()
  );
  const [absences, setAbsencesState] = useState<Absence[]>(() => loadAbsences());
  const [calendarEvents, setCalendarEventsState] = useState<CalendarEvent[]>(() =>
    loadCalendarEvents()
  );
  const [productionGoals, setProductionGoalsState] = useState<ProductionGoal[]>(() =>
    loadProductionGoals()
  );
  const [roleGoals, setRoleGoalsState] = useState<RoleGoal[]>(() => loadRoleGoals());

  const setAttendants = useCallback((updater: Attendant[] | ((prev: Attendant[]) => Attendant[])) => {
    setAttendantsState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveAttendants(next);
      return next;
    });
  }, []);

  const setAbsences = useCallback(
    (updater: Absence[] | ((prev: Absence[]) => Absence[])) => {
      setAbsencesState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        saveAbsences(next);
        return next;
      });
    },
    []
  );

  const setCalendarEvents = useCallback(
    (updater: CalendarEvent[] | ((prev: CalendarEvent[]) => CalendarEvent[])) => {
      setCalendarEventsState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        saveCalendarEvents(next);
        return next;
      });
    },
    []
  );

  const setPerformanceRecords = useCallback(
    (updater: DailyPerformanceRecord[] | ((prev: DailyPerformanceRecord[]) => DailyPerformanceRecord[])) => {
      setPerformanceRecordsState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        savePerformanceRecords(next);
        return next;
      });
    },
    []
  );

  const addAttendant = useCallback(
    (input: AttendantInput) => {
      let created!: Attendant;
      setAttendants((prev) => {
        created = createAttendant(input, prev);
        return [...prev, created];
      });
      return created;
    },
    [setAttendants]
  );

  const updateAttendant = useCallback(
    (id: number, input: AttendantInput) => {
      setAttendants((prev) =>
        prev.map((attendant) =>
          attendant.id === id ? { ...attendant, ...input } : attendant
        )
      );
      setPerformanceRecords((prev) =>
        prev.map((record) =>
          record.attendantId === id
            ? { ...record, attendantName: input.name, updatedAt: new Date().toISOString() }
            : record
        )
      );
      setAbsences((prev) =>
        prev.map((absence) =>
          absence.attendantId === id
            ? { ...absence, attendantName: input.name, updatedAt: new Date().toISOString() }
            : absence
        )
      );
    },
    [setAttendants, setPerformanceRecords, setAbsences]
  );

  const removeAttendant = useCallback(
    (id: number) => {
      setAttendants((prev) => prev.filter((a) => a.id !== id));
      setPerformanceRecords((prev) => prev.filter((r) => r.attendantId !== id));
      setAbsences((prev) => prev.filter((a) => a.attendantId !== id));
    },
    [setAttendants, setPerformanceRecords, setAbsences]
  );

  const removeAttendants = useCallback(
    (ids: number[]) => {
      const idSet = new Set(ids);
      setAttendants((prev) => prev.filter((a) => !idSet.has(a.id)));
      setPerformanceRecords((prev) => prev.filter((r) => !idSet.has(r.attendantId)));
      setAbsences((prev) => prev.filter((a) => !idSet.has(a.attendantId)));
    },
    [setAttendants, setPerformanceRecords, setAbsences]
  );

  const addAbsence = useCallback(
    (input: AbsenceInput) => {
      let created!: Absence;
      setAbsences((prev) => {
        created = createAbsence(input, attendants, prev);
        return [...prev, created];
      });
      return created;
    },
    [attendants, setAbsences]
  );

  const updateAbsence = useCallback(
    (id: number, input: AbsenceUpdateInput) => {
      setAbsences((prev) =>
        prev.map((absence) => {
          if (absence.id !== id) return absence;

          const attendantId = input.attendantId ?? absence.attendantId;
          const attendant = attendants.find((a) => a.id === attendantId);

          return {
            ...absence,
            ...input,
            attendantId,
            attendantName: attendant?.name ?? absence.attendantName,
            reason:
              input.reason !== undefined ? input.reason.trim() : absence.reason,
            updatedAt: new Date().toISOString(),
          };
        })
      );
    },
    [attendants, setAbsences]
  );

  const updateAbsenceStatus = useCallback(
    (id: number, status: Absence["status"]) => {
      setAbsences((prev) =>
        prev.map((absence) =>
          absence.id === id
            ? { ...absence, status, updatedAt: new Date().toISOString() }
            : absence
        )
      );
    },
    [setAbsences]
  );

  const removeAbsence = useCallback(
    (id: number) => {
      setAbsences((prev) => prev.filter((a) => a.id !== id));
    },
    [setAbsences]
  );

  const addCalendarEvent = useCallback(
    (input: CalendarEventInput) => {
      let created!: CalendarEvent;
      setCalendarEvents((prev) => {
        created = createCalendarEvent(input, prev);
        return [...prev, created];
      });
      return created;
    },
    [setCalendarEvents]
  );

  const updateCalendarEvent = useCallback(
    (id: number, input: CalendarEventUpdateInput) => {
      setCalendarEvents((prev) =>
        prev.map((event) => {
          if (event.id !== id) return event;
          return {
            ...event,
            ...input,
            title: input.title !== undefined ? input.title.trim() : event.title,
            endDate: input.endDate !== undefined ? input.endDate.trim() || undefined : event.endDate,
            startTime:
              input.startTime !== undefined ? input.startTime.trim() || undefined : event.startTime,
            endTime:
              input.endTime !== undefined ? input.endTime.trim() || undefined : event.endTime,
            location:
              input.location !== undefined ? input.location.trim() || undefined : event.location,
            description:
              input.description !== undefined
                ? input.description.trim() || undefined
                : event.description,
            updatedAt: new Date().toISOString(),
          };
        })
      );
    },
    [setCalendarEvents]
  );

  const removeCalendarEvent = useCallback(
    (id: number) => {
      setCalendarEvents((prev) => prev.filter((event) => event.id !== id));
    },
    [setCalendarEvents]
  );

  const addPerformanceRecord = useCallback(
    (record: DailyPerformanceRecord) => {
      setPerformanceRecords((prev) => [...prev, record]);
    },
    [setPerformanceRecords]
  );

  const updatePerformanceRecord = useCallback(
    (id: number, data: Partial<DailyPerformanceRecord>) => {
      setPerformanceRecords((prev) =>
        prev.map((record) =>
          record.id === id
            ? { ...record, ...data, updatedAt: new Date().toISOString() }
            : record
        )
      );
    },
    [setPerformanceRecords]
  );

  const removePerformanceRecord = useCallback(
    (id: number) => {
      setPerformanceRecords((prev) => prev.filter((r) => r.id !== id));
    },
    [setPerformanceRecords]
  );

  const importPerformance = useCallback(
    (
      plan: ImportPlan,
      options: ImportBatchOptions,
      meta?: { fileName?: string }
    ): ImportBatchResult => {
      const outcome = executePerformanceImport(
        plan,
        attendants,
        performanceRecords,
        options
      );
      setAttendantsState(outcome.attendants);
      saveAttendants(outcome.attendants);
      setPerformanceRecordsState(outcome.performanceRecords);
      savePerformanceRecords(outcome.performanceRecords);
      appendImportLog({
        timestamp: new Date().toISOString(),
        fileName: meta?.fileName,
        message: outcome.result.logMessage,
        imported: outcome.result.imported,
        updated: outcome.result.updated,
        skipped: outcome.result.skipped,
        uniqueAttendants: outcome.result.uniqueAttendants,
        newDays: outcome.result.newDays,
      });
      return outcome.result;
    },
    [attendants, performanceRecords]
  );

  const importProductivityReport = useCallback(
    (report: ProductivityReport, options: ProductivityImportOptions): ProductivityImportResult => {
      const outcome = executeProductivityImport(
        report,
        attendants,
        performanceRecords,
        productivityRecords,
        options
      );
      // colaboradores primeiro: os registros apontam para eles no banco
      setAttendantsState(outcome.attendants);
      saveAttendants(outcome.attendants);
      setPerformanceRecordsState(outcome.performanceRecords);
      savePerformanceRecords(outcome.performanceRecords);
      setProductivityRecordsState(outcome.productivityRecords);
      saveProductivityRecords(outcome.productivityRecords);
      appendImportLog({
        timestamp: new Date().toISOString(),
        fileName: options.fileName,
        message: outcome.logMessage,
        imported: outcome.summary.productivityCreated,
        updated: outcome.summary.productivityUpdated,
        skipped: outcome.summary.unmatchedNames.length,
        uniqueAttendants: outcome.summary.attendantsInFile,
        newDays: outcome.summary.days,
      });
      return outcome;
    },
    [attendants, performanceRecords, productivityRecords]
  );

  const setProductionGoals = useCallback((goals: ProductionGoal[]) => {
    setProductionGoalsState(goals);
    saveProductionGoals(goals);
  }, []);

  const setRoleGoals = useCallback((goals: RoleGoal[]) => {
    setRoleGoalsState(goals);
    saveRoleGoals(goals);
  }, []);

  const today = todayRange();

  const todayIndicators = useMemo(
    () => recordsToIndicators(performanceRecords, attendants, productionGoals, today),
    [performanceRecords, attendants, productionGoals, today.start, today.end]
  );

  const value = useMemo<LumoDataContextValue>(
    () => ({
      attendants,
      performanceRecords,
      productivityRecords,
      absences,
      calendarEvents,
      productionGoals,
      roleGoals,
      addAttendant,
      updateAttendant,
      removeAttendant,
      removeAttendants,
      addAbsence,
      updateAbsence,
      updateAbsenceStatus,
      removeAbsence,
      addCalendarEvent,
      updateCalendarEvent,
      removeCalendarEvent,
      addPerformanceRecord,
      updatePerformanceRecord,
      removePerformanceRecord,
      importPerformance,
      importProductivityReport,
      setProductionGoals,
      setRoleGoals,
      todayIndicators,
    }),
    [
      attendants,
      performanceRecords,
      productivityRecords,
      absences,
      calendarEvents,
      productionGoals,
      roleGoals,
      addAttendant,
      updateAttendant,
      removeAttendant,
      removeAttendants,
      addAbsence,
      updateAbsence,
      updateAbsenceStatus,
      removeAbsence,
      addCalendarEvent,
      updateCalendarEvent,
      removeCalendarEvent,
      addPerformanceRecord,
      updatePerformanceRecord,
      removePerformanceRecord,
      importPerformance,
      importProductivityReport,
      setProductionGoals,
      setRoleGoals,
      todayIndicators,
    ]
  );

  return <LumoDataContext.Provider value={value}>{children}</LumoDataContext.Provider>;
}

export function useLumoData() {
  const context = useContext(LumoDataContext);
  if (!context) {
    throw new Error("useLumoData must be used within LumoDataProvider");
  }
  return context;
}
