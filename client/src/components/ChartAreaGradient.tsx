/**
 * Degradê de gráfico de área: a cor da série no topo (--chart-area-top, definido no tema) sumindo até 0 embaixo.
 * Use dentro de <defs> do Recharts e referencie com fill="url(#id)".
 */
export default function ChartAreaGradient({
  id,
  color,
  topOpacity = "var(--chart-area-top)",
}: {
  id: string;
  color: string;
  topOpacity?: string;
}) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style={{ stopColor: color, stopOpacity: topOpacity }} />
      <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
    </linearGradient>
  );
}
