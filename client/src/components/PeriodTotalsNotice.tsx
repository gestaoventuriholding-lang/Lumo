import { useMemo } from "react";
import { Info } from "lucide-react";
import { useLumoData } from "@/contexts/LumoDataContext";
import { findHiddenPeriodTotals } from "@/lib/periodTotals";

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** Explica por que um relatório importado não aparece quando o filtro é menor que o período dele */
export default function PeriodTotalsNotice({ range }: { range: { start: string; end: string } }) {
  const { performanceRecords, productivityRecords } = useLumoData();
  const hidden = useMemo(
    () => findHiddenPeriodTotals(performanceRecords, productivityRecords, range),
    [performanceRecords, productivityRecords, range]
  );
  if (hidden.length === 0) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-1">
        {hidden.map((item) => (
          <p key={`${item.periodStart}|${item.periodEnd}`}>
            O relatório de <strong>{formatDate(item.periodStart)} a {formatDate(item.periodEnd)}</strong> (
            {item.attendances.toLocaleString("pt-BR")} atendimentos) não entra neste filtro, porque cobre um
            período maior.
          </p>
        ))}
        <p className="text-xs opacity-80">
          Para ver esses números, escolha um filtro que inclua o período inteiro. Para filtrar por dia ou
          semana, importe o relatório com “Estratificado: Sim”.
        </p>
      </div>
    </div>
  );
}
