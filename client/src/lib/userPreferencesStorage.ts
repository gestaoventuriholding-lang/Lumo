import { readJSON, writeJSON } from "@/lib/cloudStore";
import {
  DEFAULT_USER_PREFERENCES,
  type UserPreferences,
} from "@/types/userPreferences";

const STORAGE_KEY = "lumo-user-preferences";

export function loadUserPreferences(): UserPreferences {
  try {
    const stored = readJSON<Partial<UserPreferences>>(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_USER_PREFERENCES, ...stored };
    }
  } catch {
    // ignore parse errors
  }
  return { ...DEFAULT_USER_PREFERENCES };
}

export function saveUserPreferences(preferences: UserPreferences): void {
  writeJSON(STORAGE_KEY, preferences);
}
