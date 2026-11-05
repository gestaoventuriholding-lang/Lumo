/**
 * Tema único dos gráficos (Recharts). Toda cor, grade, eixo e tooltip de gráfico vem daqui, e daqui só se lê as
 * variáveis de client/src/index.css (nenhuma cor escrita no código). Assim os gráficos acompanham o modo claro e o
 * escuro sozinhos e sempre usam a paleta aprovada.
 *
 * Regras: a série principal é laranja (Ligação); a secundária é um cinza neutro (WhatsApp); verde = bom, vermelho = ruim,
 * amarelo = atenção; o laranja nunca marca alerta. Área: linha laranja com degradê que some para baixo. Grade tracejada e apagada.
 */

export const chartColors = {
  /** Série principal */
  primary: "var(--chart-1)",
  /** Séries em ordem de uso (a primeira é a principal) */
  series: ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"],
  /** Canais da central */
  ligacao: "var(--chart-1)",
  whatsapp: "var(--channel-whatsapp)",
  /** Estados */
  positive: "var(--success)",
  warning: "var(--warning-fill)",
  negative: "var(--danger)",
  /** Sem destaque */
  neutral: "var(--chart-2)",
  neutralSoft: "var(--chart-4)",
} as const;

/** Tipos de ausência */
export const absenceChartColors = {
  vacation: "var(--chart-2)",
  sick: chartColors.negative,
  personal: "var(--chart-3)",
} as const;

/** Grade tracejada e apagada, só horizontal */
export const chartGridProps = {
  vertical: false,
  stroke: "var(--chart-grid)",
  strokeDasharray: "4 4",
} as const;

export const chartAxisProps = {
  tick: { fontSize: 12, fill: "var(--muted-foreground)" },
  axisLine: false,
  tickLine: false,
} as const;

/** Cursor de barras: faixa sutil atrás da barra em foco */
export const chartCursor = { fill: "var(--card-raised)" } as const;

/** Cursor de gráficos de área e de linha: linha vertical tracejada laranja */
export const chartLineCursor = {
  stroke: "var(--chart-1)",
  strokeDasharray: "3 3",
  strokeOpacity: 0.55,
} as const;

/** Ponto em foco numa série de área ou de linha */
export const chartActiveDot = (color: string) =>
  ({ r: 5, fill: color, stroke: "var(--card)", strokeWidth: 2 }) as const;

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

/** Barras e fatias: cantos arredondados em cima; separador na cor do cartão para o empilhado não colar */
export const chartBarRadius: [number, number, number, number] = [4, 4, 0, 0];
export const chartSliceStroke = "var(--card)";

/**
 * Mapa de calor em tons de laranja: do mais baixo (--heat-low) ao mais alto (--heat-high), em 7 degraus fixos.
 * Os degraus pulam a faixa do meio em que nem texto claro nem escuro alcançam 4,5:1, então todo texto dentro de uma
 * célula passa em AA (conferido em themeTokens.test.tsx, nos dois modos).
 */
export const HEAT_STEPS = [0, 0.15, 0.3, 0.45, 0.6, 0.85, 1] as const;

/** Degrau mais próximo de um valor de 0 a 1 */
export function heatStep(valor: number): number {
  const t = Math.max(0, Math.min(1, Number.isFinite(valor) ? valor : 0));
  return HEAT_STEPS.reduce((best, s) => (Math.abs(s - t) < Math.abs(best - t) ? s : best), HEAT_STEPS[0]);
}

/** Cor CSS da célula para um valor de 0 a 1 */
export function heatColor(valor: number): string {
  return `color-mix(in srgb, var(--heat-high) ${Math.round(heatStep(valor) * 100)}%, var(--heat-low))`;
}

/** Texto dentro da célula: o do tema nas células mais escuras, e preto da marca nas mais claras (laranja forte) */
export function heatTextColor(valor: number): string {
  return heatStep(valor) >= 0.85 ? "var(--heat-text-high)" : "var(--foreground)";
}

/** Escolhe o desenho da evolução: com poucos pontos uma área fica vazia, então vale a barra */
export function trendChartKind(pontos: number): "area" | "barras" {
  return pontos >= 3 ? "area" : "barras";
}
