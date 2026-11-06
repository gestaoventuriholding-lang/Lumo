import { useMemo } from "react";
import { CalendarCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAtendimentoData } from "@/hooks/useAtendimentoData";
import type { DateRange } from "@/lib/dateRangeFilter";
import { FUNCAO_CONFIRMACAO } from "@/lib/attendantRole";
import { filterRecordsByRange } from "@/lib/performanceMetrics";
import { formatAverageTime } from "@/lib/performanceStorage";

/** Resumo da Confirmação de agenda no período: à parte do atendimento, sem ranking e sem meta (por enquanto). */
export function resumoConfirmacao(
  registros: { date: string; attendancesCount: number; averageTimeMinutes: number }[],
  range: Pick<DateRange, "start" | "end">
) {
  const doPeriodo = registros.filter((r) => r.date >= range.start && r.date <= range.end);
  const atendimentos = doPeriodo.reduce((s, r) => s + r.attendancesCount, 0);
  const tma = atendimentos > 0 ? doPeriodo.reduce((s, r) => s + r.averageTimeMinutes * r.attendancesCount, 0) / atendimentos : 0;
  return { atendimentos, tmaMinutos: tma };
}

export default function ConfirmacaoAgendaCard({ range }: { range: DateRange }) {
  const { confirmacao } = useAtendimentoData();
  const resumo = useMemo(
    () => resumoConfirmacao(filterRecordsByRange(confirmacao.performanceRecords, range), range),
    [confirmacao.performanceRecords, range]
  );
  if (confirmacao.attendants.length === 0) return null;
  const nomes = confirmacao.attendants.map((a) => a.name).join(", ");
  return (
    <Card data-testid="cartao-confirmacao">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CalendarCheck aria-hidden className="h-4 w-4" />
          {FUNCAO_CONFIRMACAO}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <p className="font-display text-2xl font-bold tabular-nums">{resumo.atendimentos.toLocaleString("pt-BR")}</p>
          <p className="text-sm text-muted-foreground">atendimentos no período</p>
          <p className="text-sm text-muted-foreground tabular-nums">
            TMA {resumo.tmaMinutos > 0 ? formatAverageTime(resumo.tmaMinutos) : "—"}
          </p>
          <p className="text-sm text-muted-foreground">Meta: —</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {nomes}. Fica fora dos rankings e das médias do atendimento.
        </p>
      </CardContent>
    </Card>
  );
}
