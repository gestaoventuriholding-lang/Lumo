import { readJSON, writeJSON } from "@/lib/cloudStore";
import { newId } from "@/lib/ids";
import type {
  CalendarEvent,
  CalendarEventInput,
} from "@/types/calendarEvent";

const STORAGE_KEY = "lumo-calendar-events";

export function loadCalendarEvents(): CalendarEvent[] {
  try {
    const stored = readJSON<CalendarEvent[]>(STORAGE_KEY);
    if (stored) {
      return stored;
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

export function saveCalendarEvents(events: CalendarEvent[]): void {
  writeJSON(STORAGE_KEY, events);
}

export function createCalendarEvent(
  input: CalendarEventInput,
  existing: CalendarEvent[]
): CalendarEvent {
  const now = new Date().toISOString();
  void existing;
  const nextId = newId();

  return {
    id: nextId,
    title: input.title.trim(),
    type: input.type,
    date: input.date,
    endDate: input.endDate?.trim() || undefined,
    startTime: input.startTime?.trim() || undefined,
    endTime: input.endTime?.trim() || undefined,
    location: input.location?.trim() || undefined,
    description: input.description?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
}
