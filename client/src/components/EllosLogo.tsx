import { useId } from "react";
import { cn } from "@/lib/utils";

type EllosLogoProps = {
  className?: string;
  /** "mark" mostra só o símbolo; "full" mostra símbolo + nome */
  variant?: "full" | "mark";
  /** Esconde o nome com fade (menu lateral recolhido); o símbolo continua no mesmo lugar */
  collapsed?: boolean;
  /** Cor do fundo onde o logo está; recorta o entrelaçamento dos elos */
  background?: string;
};

const BRAND_ORANGE = "#FF6B00";

/**
 * Símbolo da marca: dois elos entrelaçados, um laranja e um que segue o tema
 * (escuro no claro, claro no escuro). Redesenhado em SVG a partir da prancha de marca;
 * quando o arquivo oficial estiver em client/public/brand/, pode ser trocado por <img>.
 */
export function EllosMark({
  className,
  background = "var(--sidebar)",
}: {
  className?: string;
  background?: string;
}) {
  const clipId = useId();

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="Ellos"
      className={cn("shrink-0 text-foreground", className)}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="24" y="0" width="30" height="48" />
        </clipPath>
      </defs>
      <g transform="rotate(-45 24 24)" strokeWidth="5.5" strokeLinecap="round">
        <rect x="7" y="20" width="34" height="17" rx="8.5" stroke={BRAND_ORANGE} />
        <rect x="7" y="11" width="34" height="17" rx="8.5" stroke={background} strokeWidth="9.5" />
        <rect x="7" y="11" width="34" height="17" rx="8.5" stroke="currentColor" />
        <g clipPath={`url(#${clipId})`}>
          <rect x="7" y="20" width="34" height="17" rx="8.5" stroke={background} strokeWidth="9.5" />
          <rect x="7" y="20" width="34" height="17" rx="8.5" stroke={BRAND_ORANGE} />
        </g>
      </g>
    </svg>
  );
}

export function EllosLogo({
  className,
  variant = "full",
  collapsed = false,
  background,
}: EllosLogoProps) {
  if (variant === "mark") {
    return <EllosMark background={background} className={cn("h-9 w-9", className)} />;
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <EllosMark background={background} className="h-9 w-9" />
      <span
        className={cn(
          "font-display text-[1.65rem] font-bold leading-none text-foreground transition-[opacity,transform] duration-200 ease-out",
          collapsed ? "-translate-x-2 opacity-0" : "translate-x-0 opacity-100 delay-100"
        )}
      >
        Ellos
      </span>
    </span>
  );
}
