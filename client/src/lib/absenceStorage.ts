import { readJSON, writeJSON } from "@/lib/cloudStore";
import type { Absence, AbsenceInput } from "@/types/absence";
import type { Attendant } from "@/types/attendant";
import { newId } from "@/lib/ids";

const STORAGE_KEY = "lumo-absences";

export function countAbsenceDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  return Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
}

export function loadAbsences(): Absence[] {
  try {
    const stored = readJSON<Absence[]>(STORAGE_KEY);
    if (stored) {
      return stored;
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

export function saveAbsences(absences: Absence[]): void {
  writeJSON(STORAGE_KEY, absences);
}

export function createAbsence(
  input: AbsenceInput,
  attendants: Attendant[],
  existing: Absence[]
): Absence {
  const attendant = attendants.find((a) => a.id === input.attendantId);
  const now = new Date().toISOString();
  void existing;
  const nextId = newId();

  return {
    id: nextId,
    attendantId: input.attendantId,
    attendantName: attendant?.name ?? "Colaborador",
    type: input.type,
    startDate: input.startDate,
    endDate: input.endDate,
    reason: input.reason?.trim() ?? "",
    status: input.status ?? "approved",
    createdAt: now,
    updatedAt: now,
  };
}
