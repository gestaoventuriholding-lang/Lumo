import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { AlertLevel } from "@/types/goals";

export type Tone = "good" | "warn" | "bad";

const MARK = {
  good: { Icon: CheckCircle2, text: "text-success", rotulo: "Bom" },
  warn: { Icon: AlertTriangle, text: "text-warning", rotulo: "Atenção" },
  bad: { Icon: XCircle, text: "text-danger", rotulo: "Ruim" },
} as const;

export function levelToTone(level: AlertLevel | "green" | "yellow" | "red" | undefined): Tone | undefined {
  if (level === "green") return "good";
  if (level === "yellow") return "warn";
  if (level === "red") return "bad";
  return undefined;
}

/**
 * Bom, atenção e ruim nunca dependem só da cor: o símbolo (✓, ! ou ✕) vem junto, e leitores de tela ouvem o rótulo.
 */
export function ToneMark({ tone, className }: { tone: Tone; className?: string }) {
  const { Icon, text, rotulo } = MARK[tone];
  return (
    <>
      <Icon aria-hidden className={cn("h-3.5 w-3.5 shrink-0", text, className)} />
      <span className="sr-only">{rotulo}: </span>
    </>
  );
}

/** Valor colorido pelo nível, com o símbolo do nível antes dele */
export function ToneValue({ tone, children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  if (!tone) return <span className={className}>{children}</span>;
  return (
    <span className={cn("inline-flex items-center gap-1", MARK[tone].text, className)}>
      <ToneMark tone={tone} />
      {children}
    </span>
  );
}

/** Seta de tendência (▲ sobe, ▼ desce) na cor do sentido: verde = melhorou, vermelho = piorou */
export function TrendArrow({ trend, className }: { trend: "up" | "down" | "neutral"; className?: string }) {
  if (trend === "neutral") return null;
  return <span aria-hidden className={cn("mr-1", className)}>{trend === "up" ? "▲" : "▼"}</span>;
}
