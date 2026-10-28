import { isCloudEnabled, readJSON, removeKey, writeJSON } from "@/lib/cloudStore";
import type { StructureLayout, StructureMovementLog } from "@/types/structure";

const STORAGE_KEY = "lumo-structure-layout";
const STORAGE_VERSION = 3;
const VERSION_KEY = `${STORAGE_KEY}-version`;

function emptyLayout(): StructureLayout {
  return { elements: [], history: [], updatedAt: new Date().toISOString() };
}

function normalizeLayout(raw: Partial<StructureLayout>): StructureLayout {
  return {
    elements: raw.elements ?? [],
    history: raw.history ?? [],
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

export function clearStructureLayout(): void {
  removeKey(STORAGE_KEY);
  if (!isCloudEnabled()) localStorage.setItem(VERSION_KEY, String(STORAGE_VERSION));
}

export function loadStructureLayout(): StructureLayout {
  if (isCloudEnabled()) {
    const stored = readJSON<Partial<StructureLayout>>(STORAGE_KEY);
    return stored ? normalizeLayout(stored) : emptyLayout();
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedVersion = localStorage.getItem(VERSION_KEY);
    if (stored) {
      if (storedVersion !== String(STORAGE_VERSION)) {
        localStorage.setItem(VERSION_KEY, String(STORAGE_VERSION));
      }
      return normalizeLayout(JSON.parse(stored) as Partial<StructureLayout>);
    }
    if (storedVersion !== String(STORAGE_VERSION)) {
      clearStructureLayout();
    }
  } catch {
    clearStructureLayout();
  }
  return emptyLayout();
}

export function saveStructureLayout(layout: StructureLayout): void {
  if (!isCloudEnabled()) localStorage.setItem(VERSION_KEY, String(STORAGE_VERSION));
  writeJSON(STORAGE_KEY, { ...layout, updatedAt: new Date().toISOString() });
}

export function appendMovementLog(
  layout: StructureLayout,
  message: string,
  actor = "Gestor"
): StructureMovementLog {
  const entry: StructureMovementLog = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    message,
    actor,
  };
  return entry;
}
