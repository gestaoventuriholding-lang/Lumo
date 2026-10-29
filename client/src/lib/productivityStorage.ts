import { readJSON, writeJSON } from "@/lib/cloudStore";
import type { ProductivityRecord } from "@/types/productivity";

const STORAGE_KEY = "lumo-productivity-reports";

export function loadProductivityRecords(): ProductivityRecord[] {
  try {
    return readJSON<ProductivityRecord[]>(STORAGE_KEY) ?? [];
  } catch {
    return [];
  }
}

export function saveProductivityRecords(records: ProductivityRecord[]): void {
  writeJSON(STORAGE_KEY, records);
}
