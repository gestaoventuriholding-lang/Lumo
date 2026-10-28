import { readJSON, writeJSON, removeKey } from "@/lib/cloudStore";
export interface ImportLogEntry {
  id: string;
  timestamp: string;
  fileName?: string;
  message: string;
  imported: number;
  updated: number;
  skipped: number;
  uniqueAttendants: number;
  newDays: string[];
}

const STORAGE_KEY = "lumo-import-log";
const MAX_ENTRIES = 30;

export function loadImportLog(): ImportLogEntry[] {
  try {
    const parsed = readJSON<ImportLogEntry[]>(STORAGE_KEY);
    if (!parsed) return [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendImportLog(entry: Omit<ImportLogEntry, "id">): ImportLogEntry[] {
  const next: ImportLogEntry[] = [
    { ...entry, id: crypto.randomUUID() },
    ...loadImportLog(),
  ].slice(0, MAX_ENTRIES);
  writeJSON(STORAGE_KEY, next);
  return next;
}

export function clearImportLog(): void {
  removeKey(STORAGE_KEY);
}
