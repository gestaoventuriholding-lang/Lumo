import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const COUNT_UP_MS = 800;

/** Desacelera no final (ease-out cúbico) */
const easeOut = [0.16, 1, 0.3, 1] as const;

/**
 * Anima o número do valor anterior até o novo (na primeira carga, a partir de 0).
 * Devolve o valor corrente a cada quadro.
 */
export function useCountUp(target: number, duration = COUNT_UP_MS): number {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? target : 0);
  const current = useRef(display);

  useEffect(() => {
    if (reduceMotion || !Number.isFinite(target)) {
      current.current = target;
      setDisplay(target);
      return;
    }
    const controls = animate(current.current, target, {
      duration: duration / 1000,
      ease: easeOut,
      onUpdate: (v) => {
        current.current = v;
        setDisplay(v);
      },
    });
    return () => controls.stop();
  }, [target, duration, reduceMotion]);

  return display;
}

type AnimatedNumberProps = {
  value: number;
  /** Casas decimais (vírgula decimal e pontos de milhar, no padrão brasileiro) */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Troca o formato padrão (ex.: tempo em mm:ss) */
  format?: (value: number) => string;
  className?: string;
};

export function formatPtBr(value: number, decimals = 0): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function AnimatedNumber({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  format,
  className,
}: AnimatedNumberProps) {
  const display = useCountUp(value);
  const text = format ? format(display) : `${prefix}${formatPtBr(display, decimals)}${suffix}`;
  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {text}
    </span>
  );
}

/** "R$ 1.234,50", "85,3%", "1.280 atend." → prefixo, número, casas decimais e sufixo */
const NUMERIC_TEXT = /^([^\d\-−]*)(-?[−]?\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d+))?(.*)$/;

/**
 * Anima um valor que já chega formatado em pt-BR, preservando prefixo (R$), sufixo (%)
 * e casas decimais. Textos que não são número (ex.: "—", "02:35") aparecem como estão.
 */
export function AnimatedText({ text, className }: { text: string; className?: string }) {
  const match = NUMERIC_TEXT.exec(text.trim());
  const parsed = match
    ? {
        prefix: match[1],
        number: Number(`${match[2].replace(/\./g, "").replace("−", "-")}${match[3] ? `.${match[3]}` : ""}`),
        decimals: match[3]?.length ?? 0,
        suffix: match[4],
      }
    : null;
  const display = useCountUp(parsed && Number.isFinite(parsed.number) ? parsed.number : 0);

  if (!parsed || !Number.isFinite(parsed.number) || /[:/]/.test(parsed.suffix + parsed.prefix)) {
    return (
      <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
        {text}
      </span>
    );
  }

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {parsed.prefix}
      {formatPtBr(display, parsed.decimals)}
      {parsed.suffix}
    </span>
  );
}
