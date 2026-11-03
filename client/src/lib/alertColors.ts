import type { AlertLevel } from "@/types/goals";

export function alertSurfaceClass(level: AlertLevel): string {
  switch (level) {
    case "green":
      return "bg-success/10 border-success/30";
    case "yellow":
      return "bg-warning/10 border-warning/30";
    case "red":
      return "bg-danger/10 border-danger/30";
    default:
      return "bg-muted/50 border-border";
  }
}

export function alertTextClass(level: AlertLevel): string {
  switch (level) {
    case "green":
      return "text-success";
    case "yellow":
      return "text-warning";
    case "red":
      return "text-danger";
    default:
      return "text-muted-foreground";
  }
}

export function alertBadgeClass(level: AlertLevel): string {
  switch (level) {
    case "green":
      return "bg-success/10 text-success";
    case "yellow":
      return "bg-warning/10 text-warning";
    case "red":
      return "bg-danger/10 text-danger";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function alertIconClass(level: AlertLevel): string {
  switch (level) {
    case "green":
      return "text-success";
    case "yellow":
      return "text-warning";
    case "red":
      return "text-danger";
    default:
      return "text-muted-foreground";
  }
}
