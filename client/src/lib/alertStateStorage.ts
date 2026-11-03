import { getLocalDateString } from "@/lib/performanceStorage";

function storageKey(): string {
  return `ellos-alert-state-${getLocalDateString()}`;
}

interface AlertState {
  readIds: number[];
  dismissedIds: number[];
}

function loadState(): AlertState {
  try {
    const stored = localStorage.getItem(storageKey());
    if (stored) {
      return JSON.parse(stored) as AlertState;
    }
  } catch {
    // ignore
  }
  return { readIds: [], dismissedIds: [] };
}

function saveState(state: AlertState): void {
  localStorage.setItem(storageKey(), JSON.stringify(state));
}

export function loadReadAlertIds(): Set<number> {
  return new Set(loadState().readIds);
}

export function loadDismissedAlertIds(): Set<number> {
  return new Set(loadState().dismissedIds);
}

export function persistReadAlertIds(ids: Set<number>): void {
  const state = loadState();
  saveState({ ...state, readIds: Array.from(ids) });
}

export function persistDismissedAlertIds(ids: Set<number>): void {
  const state = loadState();
  saveState({ ...state, dismissedIds: Array.from(ids) });
}
