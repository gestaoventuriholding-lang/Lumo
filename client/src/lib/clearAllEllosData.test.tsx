import { describe, expect, it, beforeEach } from "vitest";
import { clearAllEllosOperationalData } from "./clearAllEllosData";

describe("clearAllEllosOperationalData", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("remove chaves operacionais do Ellos", () => {
    localStorage.setItem("ellos-attendants", "[]");
    localStorage.setItem("ellos-performance-records", "[]");
    localStorage.setItem("ellos-absences", "[]");
    localStorage.setItem("ellos-structure-layout", "{}");
    localStorage.setItem("ellos-import-log", "[]");
    localStorage.setItem("ellos-alert-state-2026-06-09", "{}");
    localStorage.setItem("theme", "dark");

    const result = clearAllEllosOperationalData();

    expect(localStorage.getItem("ellos-attendants")).toBeNull();
    expect(localStorage.getItem("ellos-performance-records")).toBeNull();
    expect(localStorage.getItem("ellos-import-log")).toBeNull();
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(result.clearedAlertStateKeys).toBe(1);
  });
});
