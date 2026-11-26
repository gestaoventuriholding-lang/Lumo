import { useMemo, useState } from "react";
import { Loader2, Split } from "lucide-react";
import { Button } from "@/components/ui/button";
import CartaoFuncao from "@/components/CartaoFuncao";
import { Input } from "@/components/ui/input";
import { useAtendimentoData } from "@/hooks/useAtendimentoData";
import type { DateRange } from "@/lib/dateRangeFilter";
import { listarTransferencias, MENSAGEM_ATENDIMENTO_TESTE, atendimentoInventado, type ResumoTransferencias } from "@/lib/atendimentoEscallo";
import { filterRecordsByRange } from "@/lib/performanceMetrics";
import type { Attendant } from "@/types/attendant";

const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Triagem (gestão): o que ela recebe fica registrado, mas não conta como atendimento. Mostra o volume no período e, por dia, para quem ela transferiu. */
export default function TriagemCard({ range }: { range: DateRange }) {
  const { triagem } = useAtendimentoData();
  const volume = useMemo(
    () => filterRecordsByRange(triagem.performanceRecords, range).reduce((s, r) => s + r.attendancesCount, 0),
    [triagem.performanceRecords, range]
  );
  if (triagem.attendants.length === 0) return null;
  return (
    <CartaoFuncao
      testId="cartao-triagem"
      icon={Split}
      titulo="Triagem"
      pessoas={triagem.attendants.map((a) => a.name).join(", ")}
      metricas={[{ rotulo: "conversas recebidas no período", valor: volume.toLocaleString("pt-BR") }]}
      nota="Não conta como atendimento: fica fora dos totais, médias, metas e rankings."
    >
      {triagem.attendants.map((a) => (
        <TransferenciasDoDia key={a.id} colaborador={a} />
      ))}
    </CartaoFuncao>
  );
}

function TransferenciasDoDia({ colaborador }: { colaborador: Attendant }) {
  const [dia, setDia] = useState(hojeIso());
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [resumo, setResumo] = useState<ResumoTransferencias | null>(null);
  const codigo = colaborador.escalloCodigo;

  async function buscar() {
    if (typeof codigo !== "number") return;
    setCarregando(true);
    setErro("");
    setResumo(null);
    try {
      setResumo(await listarTransferencias(dia, codigo));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui buscar as transferências agora.");
    } finally {
      setCarregando(false);
    }
  }

  if (typeof codigo !== "number") {
    return <p className="text-xs text-muted-foreground">{colaborador.name} não tem código da Escallo: vincule em Atendentes para ver as transferências.</p>;
  }
  return (
    <div className="space-y-2 border-t border-border pt-4" data-testid="transferencias-triagem">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`transf-dia-${colaborador.id}`} className="text-xs font-medium text-muted-foreground">
            Transferências de {colaborador.name} no dia
          </label>
          <Input id={`transf-dia-${colaborador.id}`} type="date" max={hojeIso()} value={dia} onChange={(e) => setDia(e.target.value)} className="w-44" />
        </div>
        <Button variant="outline" onClick={buscar} disabled={carregando || !dia} data-testid="buscar-transferencias">
          {carregando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
          Ver transferências
        </Button>
      </div>
      {carregando && <p className="text-xs text-muted-foreground">Lendo as conversas do dia na Escallo (pode levar alguns segundos)…</p>}
      {erro && (
        <p role="alert" className="text-sm text-danger" data-testid="erro-transferencias">
          {erro}
        </p>
      )}
      {resumo && (
        <div className="space-y-1 text-sm" data-testid="resumo-transferencias">
          <p className="tabular-nums">
            {resumo.conversas} {resumo.conversas === 1 ? "conversa recebida" : "conversas recebidas"} · {resumo.transferidas}{" "}
            {resumo.transferidas === 1 ? "transferida" : "transferidas"} · {resumo.semTransferencia} sem transferência
          </p>
          {resumo.destinos.length > 0 && (
            <ul className="space-y-0.5">
              {resumo.destinos.map((d) => (
                <li key={d.codigo} className="flex justify-between gap-4 tabular-nums">
                  <span>{d.nome || `Agente ${d.codigo}`}</span>
                  <span>{d.quantidade}</span>
                </li>
              ))}
            </ul>
          )}
          {atendimentoInventado() && <p className="text-xs text-muted-foreground">{MENSAGEM_ATENDIMENTO_TESTE}</p>}
        </div>
      )}
    </div>
  );
}
