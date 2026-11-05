import { KEYS, readJSON, writeJSON } from "@/lib/cloudStore";
import type { LoginAlert } from "@/types/loginAlert";

export function loadLoginAlerts(): LoginAlert[] {
  try {
    return readJSON<LoginAlert[]>(KEYS.loginAlerts) ?? [];
  } catch {
    return [];
  }
}

export function saveLoginAlerts(alerts: LoginAlert[]): void {
  writeJSON(KEYS.loginAlerts, alerts);
}
