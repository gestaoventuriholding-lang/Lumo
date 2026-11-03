import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePeriodFilter } from "@/contexts/PeriodFilterContext";
import type { DashboardPeriod } from "@/lib/dateRangeFilter";
import { cn } from "@/lib/utils";

type PeriodFilterBarProps = {
  className?: string;
  showScopeHint?: boolean;
};

export default function PeriodFilterBar({
  className,
  showScopeHint = true,
}: PeriodFilterBarProps) {
  const {
    period,
    selectedDay,
    selectedWeek,
    selectedMonth,
    dateRange,
    setPeriod,
    setSelectedDay,
    setSelectedWeek,
    setSelectedMonth,
  } = usePeriodFilter();

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-end gap-4 p-4 ellos-panel-sm",
        className
      )}
    >
      <div className="space-y-2">
        <Label>Período</Label>
        <Select value={period} onValueChange={(value) => setPeriod(value as DashboardPeriod)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Por Dia</SelectItem>
            <SelectItem value="week">Por Semana</SelectItem>
            <SelectItem value="month">Por Mês</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>
          {period === "day" && "Selecione o dia"}
          {period === "week" && "Selecione um dia da semana"}
          {period === "month" && "Selecione o mês"}
        </Label>
        {period === "day" && (
          <Input
            type="date"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="w-44"
          />
        )}
        {period === "week" && (
          <Input
            type="date"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="w-44"
          />
        )}
        {period === "month" && (
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-44"
          />
        )}
      </div>

      {showScopeHint && (
        <div className="text-sm text-muted-foreground pb-2">
          Exibindo: <span className="font-medium text-foreground">{dateRange.label}</span>
          <span className="hidden sm:inline text-xs ml-2">(sincronizado entre telas)</span>
        </div>
      )}
    </div>
  );
}
