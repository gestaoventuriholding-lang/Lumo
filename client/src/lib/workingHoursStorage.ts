import { readJSON, writeJSON } from "@/lib/cloudStore";
import type { WorkingHoursOption } from "@/types/attendant";

const STORAGE_KEY = "lumo-working-hours";

export function loadWorkingHoursOptions(): WorkingHoursOption[] {
  try {
    return readJSON<WorkingHoursOption[]>(STORAGE_KEY) ?? [];
  } catch {
    return [];
  }
}

export function saveWorkingHoursOptions(options: WorkingHoursOption[]): void {
  writeJSON(STORAGE_KEY, options);
}
