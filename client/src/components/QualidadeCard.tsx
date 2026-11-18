import { useMemo } from "react";
import { Link } from "wouter";
import { ClipboardCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEllosData } from "@/contexts/EllosDataContext";
import { useAtendimentoData } from "@/hooks/useAtendimentoData";
import type { DateRange } from "@/lib/dateRangeFilter";
import { qualidadeNoPeriodo } from "@/lib/auditLogic";

/** Qualidade no período: nota média das auditorias de atendimento, quem está abaixo da nota mínima e quem ainda não foi auditado. */
export default function QualidadeCard({ range }: { range: DateRange }) {
  const { audits, auditSettings } = useEllosData();
  const { attendants } = useAtendimentoData();
  const q = useMemo(
    () => qualidadeNoPeriodo(audits, attendants, auditSettings, range),
    [audits, attendants, auditSettings, range]
  );
  return (
    <Card data-testid="cartao-qualidade">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground">
          <span className="flex items-center gap-2">
            <ClipboardCheck aria-hidden className="h-4 w-4" />
            Qualidade
          </span>
          <Link href="/audits" className="text-xs font-medium text-primary hover:underline">
            Ver auditorias
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {q.totalAudits === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma auditoria de atendimento no período.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <p
                className={`font-display text-2xl font-bold tabular-nums ${
                  q.average !== undefined && q.average < auditSettings.minScore ? "text-danger" : ""
                }`}
              >
                {q.average !== undefined ? q.average.toLocaleString("pt-BR") : "—"}
              </p>
              <p className="text-sm text-muted-foreground">nota média (mínima {auditSettings.minScore})</p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {q.totalAudits.toLocaleString("pt-BR")} {q.totalAudits === 1 ? "auditoria" : "auditorias"}
              </p>
              <p className="text-sm text-muted-foreground tabular-nums">{q.eliminated} eliminada{q.eliminated === 1 ? "" : "s"}</p>
            </div>
            <p className="text-xs text-muted-foreground" data-testid="qualidade-resumo">
              {q.belowMin.length > 0
                ? `Abaixo da nota mínima: ${q.belowMin.map((x) => `${x.attendant.name} (${x.average.toLocaleString("pt-BR")})`).join(", ")}. `
                : "Ninguém abaixo da nota mínima. "}
              {q.withoutAudit > 0 ? `${q.withoutAudit} sem auditoria no período.` : "Todos foram auditados no período."}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
