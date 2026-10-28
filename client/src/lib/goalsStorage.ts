import { readJSON, writeJSON } from "@/lib/cloudStore";
import type { ProductionGoal, RoleGoal } from "@/types/goals";

const PRODUCTION_KEY = "lumo-production-goals";
const ROLE_KEY = "lumo-role-goals";

export function loadProductionGoals(): ProductionGoal[] {
  try {
    const stored = readJSON<ProductionGoal[]>(PRODUCTION_KEY);
    if (stored) return stored;
  } catch {
    // ignore
  }
  return [];
}

export function saveProductionGoals(goals: ProductionGoal[]): void {
  writeJSON(PRODUCTION_KEY, goals);
}

export function loadRoleGoals(): RoleGoal[] {
  try {
    const stored = readJSON<RoleGoal[]>(ROLE_KEY);
    if (stored) return stored;
  } catch {
    // ignore
  }
  return [];
}

export function saveRoleGoals(goals: RoleGoal[]): void {
  writeJSON(ROLE_KEY, goals);
}
