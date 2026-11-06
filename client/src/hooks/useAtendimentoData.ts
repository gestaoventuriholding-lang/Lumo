import { useMemo } from "react";
import { useEllosData } from "@/contexts/EllosDataContext";
import { separarPorFuncao } from "@/lib/attendantRole";

/**
 * Dados para rankings, médias, metas e contagens: só colaboradores de Atendimento.
 * A Confirmação de agenda vem separada em `confirmacao`, para aparecer à parte e sem meta.
 */
export function useAtendimentoData() {
  const { attendants, performanceRecords, productivityRecords } = useEllosData();
  return useMemo(() => {
    const desempenho = separarPorFuncao(attendants, performanceRecords);
    const produtividade = separarPorFuncao(attendants, productivityRecords);
    return {
      attendants: desempenho.atendimento.attendants,
      performanceRecords: desempenho.atendimento.records,
      productivityRecords: produtividade.atendimento.records,
      confirmacao: {
        attendants: desempenho.confirmacao.attendants,
        performanceRecords: desempenho.confirmacao.records,
        productivityRecords: produtividade.confirmacao.records,
      },
    };
  }, [attendants, performanceRecords, productivityRecords]);
}
