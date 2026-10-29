import { useId } from "react";
import { cn } from "@/lib/utils";

type ElosLogoProps = {
  className?: string;
  /** "mark" mostra só o símbolo; "full" mostra símbolo + nome */
  variant?: "full" | "mark";
  /** "onDark": para fundos azul-marinho (menu lateral). "onLight": segue o tema da página */
  tone?: "onDark" | "onLight";
};

const BRAND_BLUE = "#3366FF";
const BRAND_NAVY = "#0B1F44";

/** Dois elos entrelaçados: um azul e um claro (branco no escuro, marinho no claro) */
export function ElosMark({
  className,
  tone = "onDark",
}: {
  className?: string;
  tone?: "onDark" | "onLight";
}) {
  const clipId = useId();
  const halo = tone === "onDark" ? BRAND_NAVY : "var(--card)";
  const linkColor = tone === "onDark" ? "text-white" : "text-[#0B1F44] dark:text-white";

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="Elos"
      className={cn("shrink-0", linkColor, className)}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="24" y="0" width="30" height="48" />
        </clipPath>
      </defs>
      <g transform="rotate(-45 24 24)" strokeWidth="5.5" strokeLinecap="round">
        <rect x="7" y="20" width="34" height="17" rx="8.5" stroke={BRAND_BLUE} />
        <rect x="7" y="11" width="34" height="17" rx="8.5" stroke={halo} strokeWidth="9.5" />
        <rect x="7" y="11" width="34" height="17" rx="8.5" stroke="currentColor" />
        <g clipPath={`url(#${clipId})`}>
          <rect x="7" y="20" width="34" height="17" rx="8.5" stroke={halo} strokeWidth="9.5" />
          <rect x="7" y="20" width="34" height="17" rx="8.5" stroke={BRAND_BLUE} />
        </g>
      </g>
    </svg>
  );
}

export function ElosLogo({ className, variant = "full", tone = "onDark" }: ElosLogoProps) {
  if (variant === "mark") {
    return <ElosMark tone={tone} className={cn("h-9 w-9", className)} />;
  }

  return (
    <span className={cn("inline-flex items-center gap-2 select-none", className)}>
      <ElosMark tone={tone} className="h-9 w-9" />
      <span
        className={cn(
          "text-[1.65rem] font-semibold leading-none tracking-tight",
          tone === "onDark" ? "text-white" : "text-[#0B1F44] dark:text-white"
        )}
      >
        Elos
      </span>
    </span>
  );
}
