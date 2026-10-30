import { cn } from "@/lib/utils";
import type { Change } from "@/lib/periodComparison";

/** Linha pequena com a variação frente ao período anterior (verde = melhorou, vermelho = piorou) */
export default function ChangeBadge({ change, className }: { change: Change; className?: string }) {
  return (
    <p
      className={cn(
        "text-xs font-medium",
        change.tone === "good" && "text-emerald-600 dark:text-emerald-400",
        change.tone === "bad" && "text-red-600 dark:text-red-400",
        change.tone === "neutral" && "text-muted-foreground",
        className
      )}
    >
      {change.text}
    </p>
  );
}
