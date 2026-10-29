/** 529075 s → "146h 57m"; abaixo de 1h → "12m 25s" */
export function formatSecondsShort(seconds: number | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  const secs = total % 60;
  return `${minutes}m ${String(secs).padStart(2, "0")}s`;
}

export function formatPercent(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function formatBrDate(iso: string | undefined): string {
  if (!iso) return "—";
  return iso.split("-").reverse().join("/");
}
