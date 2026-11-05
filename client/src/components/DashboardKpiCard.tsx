import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { motion, cardItemVariants, CHART_DRAW_MS } from "@/lib/motionVariants";
import { AnimatedText } from "@/components/AnimatedNumber";
import type { LucideIcon } from "lucide-react";
import ChangeBadge from "@/components/ChangeBadge";
import type { Change } from "@/lib/periodComparison";

type SparkPoint = { v: number };

interface DashboardKpiCardProps {
  title: string;
  value: string;
  comparison: string;
  footnote?: string;
  /** Variação frente ao período anterior */
  delta?: Change;
  trend: "up" | "down" | "neutral";
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  sparkColor: string;
  sparkData: SparkPoint[];
  /** "dark" é o cartão de destaque: fundo preto da marca, número laranja */
  variant?: "light" | "dark";
  /** 0 a 100: mostra uma barra de progresso laranja */
  progress?: number;
}

export default function DashboardKpiCard({
  title,
  value,
  comparison,
  footnote,
  delta,
  trend,
  icon: Icon,
  iconBg,
  iconColor,
  sparkColor,
  sparkData,
  variant = "light",
  progress,
}: DashboardKpiCardProps) {
  const dark = variant === "dark";
  return (
    <motion.div
      variants={cardItemVariants}
      className={cn(
        "ellos-panel-sm relative overflow-hidden p-5 transition-colors duration-200",
        dark
          ? "border-primary/40 bg-card shadow-glow"
          : "hover:border-primary/40"
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-lg", dark ? "bg-primary-soft" : iconBg)}>
          <Icon className={cn("h-[22px] w-[22px]", dark ? "text-primary" : iconColor)} />
        </div>
        {sparkData.length > 1 && (
          <div className="h-11 w-24 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData}>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={sparkColor}
                  fill={sparkColor}
                  fillOpacity={dark ? 0.25 : 0.18}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive
                  animationDuration={CHART_DRAW_MS}
                  animationEasing="ease-in-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <p className={cn("text-sm font-medium", "text-muted-foreground")}>{title}</p>
      <p className={cn("font-display mt-1 text-3xl font-bold", dark ? "text-brand-text" : "text-foreground")}>
        <AnimatedText text={value} />
      </p>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-primary-soft">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
      <p
        className={cn(
          "mt-3 text-xs font-medium",
          trend === "up" && "text-success",
          trend === "down" && "text-danger",
          trend === "neutral" && "text-muted-foreground"
        )}
      >
        {comparison}
      </p>
      {delta ? <ChangeBadge change={delta} className="mt-1" /> : null}
      {footnote ? (
        <p className={cn("mt-1 text-xs", "text-muted-foreground")}>{footnote}</p>
      ) : null}
    </motion.div>
  );
}
