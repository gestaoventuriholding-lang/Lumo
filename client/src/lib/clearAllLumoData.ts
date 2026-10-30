import { flushCloud, isCloudEnabled, removeKey } from "@/lib/cloudStore";
const OPERATIONAL_KEYS = [
  "lumo-attendants",
  "lumo-performance-records",
  "lumo-productivity-reports",
  "lumo-productivity-limits",
  "lumo-absences",
  "lumo-production-goals",
  "lumo-role-goals",
  "lumo-period-filter",
  "lumo-import-log",
  "lumo-structure-layout",
  "lumo-structure-layout-version",
] as const;

const CLOUD_KEYS = new Set<string>([
  "lumo-attendants",
  "lumo-performance-records",
  "lumo-productivity-reports",
  "lumo-productivity-limits",
  "lumo-absences",
  "lumo-production-goals",
  "lumo-role-goals",
  "lumo-import-log",
  "lumo-structure-layout",
]);

export type ClearedLumoDataArea =
  | "attendants"
  | "performance"
  | "absences"
  | "goals"
  | "structure"
  | "periodFilter"
  | "importLog"
  | "alertState";

export interface ClearAllLumoDataResult {
  clearedKeys: string[];
  clearedAlertStateKeys: number;
}

/**
 * Remove todos os dados operacionais do Lumo. Mantém tema, login e preferências de UI.
 * Com login, apaga também no banco (para o admin, isso inclui os dados de todos os usuários).
 */
export function clearAllLumoOperationalData(): ClearAllLumoDataResult {
  const clearedKeys: string[] = [];
  for (const key of OPERATIONAL_KEYS) {
    if (isCloudEnabled()) {
      if (CLOUD_KEYS.has(key)) {
        clearedKeys.push(key);
        removeKey(key);
      } else if (localStorage.getItem(key) != null) {
        clearedKeys.push(key);
        localStorage.removeItem(key);
      }
      continue;
    }
    if (localStorage.getItem(key) != null) {
      clearedKeys.push(key);
    }
    localStorage.removeItem(key);
  }
  let clearedAlertStateKeys = 0;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith("lumo-alert-state-")) {
      localStorage.removeItem(key);
      clearedAlertStateKeys++;
    }
  }
  return { clearedKeys, clearedAlertStateKeys };
}

export async function resetLumoAppData(): Promise<ClearAllLumoDataResult> {
  const result = clearAllLumoOperationalData();
  await flushCloud();
  window.location.reload();
  return result;
}
