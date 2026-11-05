import { flushCloud, isCloudEnabled, removeKey } from "@/lib/cloudStore";
const OPERATIONAL_KEYS = [
  "ellos-attendants",
  "ellos-performance-records",
  "ellos-productivity-reports",
  "ellos-productivity-limits",
  "ellos-absences",
  "ellos-incidents",
  "ellos-login-alerts",
  "ellos-production-goals",
  "ellos-role-goals",
  "ellos-period-filter",
  "ellos-import-log",
  "ellos-structure-layout",
  "ellos-structure-layout-version",
] as const;

const CLOUD_KEYS = new Set<string>([
  "ellos-attendants",
  "ellos-performance-records",
  "ellos-productivity-reports",
  "ellos-productivity-limits",
  "ellos-absences",
  "ellos-incidents",
  "ellos-login-alerts",
  "ellos-production-goals",
  "ellos-role-goals",
  "ellos-import-log",
  "ellos-structure-layout",
]);

export type ClearedEllosDataArea =
  | "attendants"
  | "performance"
  | "absences"
  | "goals"
  | "structure"
  | "periodFilter"
  | "importLog"
  | "alertState";

export interface ClearAllEllosDataResult {
  clearedKeys: string[];
  clearedAlertStateKeys: number;
}

/**
 * Remove todos os dados operacionais do Ellos. Mantém tema, login e preferências de UI.
 * Com login, apaga também no banco (para o admin, isso inclui os dados de todos os usuários).
 */
export function clearAllEllosOperationalData(): ClearAllEllosDataResult {
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
    if (key?.startsWith("ellos-alert-state-")) {
      localStorage.removeItem(key);
      clearedAlertStateKeys++;
    }
  }
  return { clearedKeys, clearedAlertStateKeys };
}

export async function resetEllosAppData(): Promise<ClearAllEllosDataResult> {
  const result = clearAllEllosOperationalData();
  await flushCloud();
  window.location.reload();
  return result;
}
