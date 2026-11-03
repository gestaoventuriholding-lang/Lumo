/**
 * Tema único dos gráficos (Recharts). Toda cor, grade, eixo e tooltip de gráfico vem daqui.
 * A série principal é laranja; as secundárias são neutras. Grade, eixos e tooltip leem as
 * variáveis CSS, então acompanham o modo claro e o escuro sozinhos.
 */

const PRIMARY = "#FF6B00";

export const chartColors = {
  /** Série principal */
  primary: PRIMARY,
  /** Séries secundárias, em ordem de uso (a primeira é a principal) */
  series: [PRIMARY, "#6B6866", "#A3A09C", "#D4D1CC", "#9A9794"],
  /** Canais da central */
  ligacao: PRIMARY,
  whatsapp: "var(--channel-whatsapp)",
  /** Estados */
  positive: "#2F7D5B",
  warning: "#B7791F",
  negative: "#C2410C",
  /** Sem destaque */
  neutral: "#A3A09C",
  neutralSoft: "#D4D1CC",
} as const;

/** Tipos de ausência */
export const absenceChartColors = {
  vacation: "#6B6866",
  sick: chartColors.negative,
  personal: "#A3A09C",
} as const;

/** Grade só horizontal, sem linhas verticais */
export const chartGridProps = {
  vertical: false,
  stroke: "var(--chart-grid)",
} as const;

export const chartAxisProps = {
  tick: { fontSize: 12, fill: "var(--muted-foreground)" },
  axisLine: false,
  tickLine: false,
} as const;

export const chartCursor = { fill: "var(--accent)" } as const;

/** Tooltip: fundo da superfície, borda de 1px e Inter tabular */
export const chartTooltipContentStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  color: "var(--card-foreground)",
  boxShadow: "var(--shadow-surface)",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  fontVariantNumeric: "tabular-nums",
  fontSize: 13,
} as const;
