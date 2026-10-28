import { readText, writeText } from "@/lib/cloudStore";
const STORAGE_KEY = "lumo-analysis-note";

export function loadAnalysisNote(): string {
  try {
    return readText(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveAnalysisNote(note: string): void {
  writeText(STORAGE_KEY, note);
}
