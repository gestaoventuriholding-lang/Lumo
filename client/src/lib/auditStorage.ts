import { KEYS, readJSON, writeJSON } from "@/lib/cloudStore";
import { DEFAULT_AUDIT_SETTINGS, type Audit, type AuditChecklist, type AuditItem, type AuditSettings } from "@/types/audit";

function load<T>(key: string): T[] {
  try {
    return readJSON<T[]>(key) ?? [];
  } catch {
    return [];
  }
}

export const loadAuditChecklists = () => load<AuditChecklist>(KEYS.auditChecklists);
export const saveAuditChecklists = (v: AuditChecklist[]) => writeJSON(KEYS.auditChecklists, v);
export const loadAuditItems = () => load<AuditItem>(KEYS.auditItems);
export const saveAuditItems = (v: AuditItem[]) => writeJSON(KEYS.auditItems, v);
export const loadAudits = () => load<Audit>(KEYS.audits);
export const saveAudits = (v: Audit[]) => writeJSON(KEYS.audits, v);

export function loadAuditSettings(): AuditSettings {
  return load<AuditSettings>(KEYS.auditSettings)[0] ?? DEFAULT_AUDIT_SETTINGS;
}
export const saveAuditSettings = (v: AuditSettings) => writeJSON(KEYS.auditSettings, [v]);
