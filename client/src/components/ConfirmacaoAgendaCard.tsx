import { useMemo } from "react";
import { CalendarCheck } from "lucide-react";
import CartaoFuncao from "@/components/CartaoFuncao";
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
    <CartaoFuncao
      testId="cartao-confirmacao"
      icon={CalendarCheck}
      titulo={FUNCAO_CONFIRMACAO}
      pessoas={nomes}
      metricas={[
        { rotulo: "atendimentos no período", valor: resumo.atendimentos.toLocaleString("pt-BR") },
        { rotulo: "tempo médio (TMA)", valor: resumo.tmaMinutos > 0 ? formatAverageTime(resumo.tmaMinutos) : "—" },
      ]}
      nota="Sem meta. Fica fora dos rankings e das médias do atendimento."
    />
  );
}
