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
}: DashboardKpiCardProps) {
  return (
    <motion.div variants={cardItemVariants} className="lumo-panel-sm p-4 transition-[box-shadow,border-color] duration-200 hover:border-primary/30 hover:shadow-raised">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", iconBg)}>
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
        {sparkData.length > 1 && (
          <div className="h-10 w-[72px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData}>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={sparkColor}
                  fill={sparkColor}
                  fillOpacity={0.12}
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
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
        <AnimatedText text={value} />
      </p>
      <p
        className={cn(
          "mt-2 text-xs font-medium",
          trend === "up" && "text-emerald-600 dark:text-emerald-400",
          trend === "down" && "text-red-600 dark:text-red-400",
          trend === "neutral" && "text-muted-foreground"
        )}
      >
        {comparison}
      </p>
      {delta ? <ChangeBadge change={delta} className="mt-1" /> : null}
      {footnote ? <p className="mt-1 text-xs text-muted-foreground">{footnote}</p> : null}
    </motion.div>
  );
}
