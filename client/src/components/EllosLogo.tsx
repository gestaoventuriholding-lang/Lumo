import { cn } from "@/lib/utils";

type EllosLogoProps = {
  className?: string;
  /** "mark" mostra só o "e"; "full" mostra o nome inteiro */
  variant?: "full" | "mark";
  /** Esconde "llos" com fade (menu lateral recolhido); o "e" continua no mesmo lugar */
  collapsed?: boolean;
};

/**
 * Wordmark provisório em texto: "ellos" minúsculo, Manrope 700, com o "e" em laranja.
 * Quando os arquivos /brand/ellos-symbol.svg e /brand/ellos-logo.svg forem adicionados em
 * client/public/brand/, troque o conteúdo deste componente por <img> apontando para eles.
 */
export function EllosLogo({ className, variant = "full", collapsed = false }: EllosLogoProps) {
  return (
    <span
      role="img"
      aria-label="Ellos"
      className={cn(
        "font-display inline-flex select-none items-baseline text-[1.65rem] font-bold leading-none text-foreground",
        className
      )}
    >
      <span className="text-primary">e</span>
      {variant === "full" && (
        <span
          className={cn(
            "transition-[opacity,transform] duration-200 ease-out",
            collapsed ? "-translate-x-2 opacity-0" : "translate-x-0 opacity-100 delay-100"
          )}
        >
          llos
        </span>
      )}
    </span>
  );
}
