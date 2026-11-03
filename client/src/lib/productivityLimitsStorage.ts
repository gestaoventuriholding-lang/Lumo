import { readJSON, writeJSON } from "@/lib/cloudStore";
import type { ProductivityLimit } from "@/types/productivity";

const STORAGE_KEY = "ellos-productivity-limits";

export function loadProductivityLimits(): ProductivityLimit[] {
  try {
    return readJSON<ProductivityLimit[]>(STORAGE_KEY) ?? [];
  } catch {
    return [];
  }
}

export function saveProductivityLimits(limits: ProductivityLimit[]): void {
  writeJSON(STORAGE_KEY, limits);
}
