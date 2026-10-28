import { readJSON, writeJSON } from "@/lib/cloudStore";
import type { DailyPerformanceRecord } from "@/types/performance";

const STORAGE_KEY = "lumo-performance-records";

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function loadPerformanceRecords(): DailyPerformanceRecord[] {
  try {
    const stored = readJSON<DailyPerformanceRecord[]>(STORAGE_KEY);
    if (stored) {
      return stored;
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

export function savePerformanceRecords(records: DailyPerformanceRecord[]): void {
  writeJSON(STORAGE_KEY, records);
}

export function formatAverageTime(minutes: number): string {
  const wholeMinutes = Math.floor(minutes);
  const seconds = Math.round((minutes - wholeMinutes) * 60);
  if (seconds === 0) {
    return `${wholeMinutes}m`;
  }
  return `${wholeMinutes}m ${seconds}s`;
}

export function parseTimeInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const mmss = trimmed.match(/^(\d+)\s*m\s*(\d+)\s*s?$/i);
  if (mmss) {
    return parseInt(mmss[1], 10) + parseInt(mmss[2], 10) / 60;
  }

  const minutesOnly = trimmed.match(/^(\d+)\s*m?$/i);
  if (minutesOnly) {
    return parseInt(minutesOnly[1], 10);
  }

  const decimal = Number(trimmed.replace(",", "."));
  if (!Number.isNaN(decimal) && decimal > 0) {
    return decimal;
  }

  return null;
}
