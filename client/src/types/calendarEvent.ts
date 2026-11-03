export type CalendarEventType = "meeting" | "appointment" | "event" | "reminder";

export interface CalendarEvent {
  id: number;
  title: string;
  type: CalendarEventType;
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventInput {
  title: string;
  type: CalendarEventType;
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
}

export interface CalendarEventUpdateInput extends Partial<CalendarEventInput> {}

export const CALENDAR_EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  meeting: "Reunião",
  appointment: "Compromisso",
  event: "Acontecimento",
  reminder: "Lembrete",
};

export const CALENDAR_EVENT_TYPE_COLORS: Record<CalendarEventType, string> = {
  meeting: "bg-primary-soft text-primary border-primary/30",
  appointment: "bg-muted text-foreground border-border",
  event: "bg-success/10 text-success border-success/30",
  reminder: "bg-warning/10 text-warning border-warning/30",
};

export const CALENDAR_EVENT_TYPE_DOT: Record<CalendarEventType, string> = {
  meeting: "bg-primary",
  appointment: "bg-foreground",
  event: "bg-success",
  reminder: "bg-warning",
};
