import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Loader2, PlayCircle, RefreshCw, Workflow } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSyncStatus } from "@/contexts/SyncStatusContext";
import { definirAgendadorAtivo, executarSync, type RespostaSync } from "@/lib/syncApi";
import { diaMesSp, diaSp, horaSp, MINUTOS_SEM_SUCESSO_PARA_ALERTA, MODE_LABEL, STATUS_LABEL, type SyncRun } from "@/lib/syncStatus";
import { cn } from "@/lib/utils";

const fmt = (n: number) => n.toLocaleString("pt-BR");

/** Texto curto do que uma execução fez */
export function resumoDaExecucao(r: SyncRun): string {
  if (r.status === "erro") return r.error ?? "Erro sem detalhe";
  if (r.status === "pulado") return r.error ?? "Pulada";
  if (r.status === "executando") return "Em andamento";
  const partes = [`${fmt(r.rowsInserted)} novas`, `${fmt(r.rowsUpdated)} atualizadas`];
  if (r.rowsSkippedManual > 0) partes.push(`${fmt(r.rowsSkippedManual)} de planilha/manual preservadas`);
  if (r.loginBlanked > 0) partes.push(`${fmt(r.loginBlanked)} com login desconsiderado`);
  if (r.alertsCreated > 0) partes.push(`${fmt(r.alertsCreated)} alerta(s) novo(s)`);
  return partes.join(" · ");
}

function diasDaExecucao(r: SyncRun): string {
  return r.days.length ? r.days.map((d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`).join(", ") : "—";
}

/** Configurações: ligar/desligar o agendador, rodar a sincronização agora e ver as últimas execuções. Só administrador. */
export default function SyncEscalloCard() {
  const { runs, enabled, loaded, readError, atualizadoTexto, alerta, tempoReal, refresh } = useSyncStatus();
  const [ocupado, setOcupado] = useState<null | "ligar" | "simular" | "manual">(null);
  const [confirmar, setConfirmar] = useState<null | "ligar" | "manual">(null);
  const [simulacao, setSimulacao] = useState<RespostaSync | null>(null);
  const hoje = diaSp(new Date());

  const mudarAgendador = async (ativo: boolean) => {
    setOcupado("ligar");
    try {
      await definirAgendadorAtivo(ativo);
      await refresh();
      toast.success(ativo ? "Agendador ligado" : "Agendador desligado", { id: "sync-agendador" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui mudar o agendador.");
    } finally {
      setOcupado(null);
    }
  };

  const simularHoje = async () => {
    setOcupado("simular");
    setSimulacao(null);
    try {
      setSimulacao(await executarSync("simulacao", [hoje]));
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "A simulação falhou.");
    } finally {
      setOcupado(null);
    }
  };

  const sincronizarAgora = async () => {
    setOcupado("manual");
    try {
      const r = await executarSync("manual", [hoje]);
      await refresh();
      toast.success(`Sincronizado: ${fmt(r.gravacao.inseridas)} novas e ${fmt(r.gravacao.atualizadas)} atualizadas`, { duration: 6000 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "A sincronização falhou.");
      await refresh();
    } finally {
      setOcupado(null);
    }
  };

  return (
    <Card data-testid="sync-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Workflow className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Sincronização com a Escallo</CardTitle>
            <CardDescription>
              Traz os relatórios de ligação e WhatsApp do dia sem baixar planilha. Segunda a sábado, de hora em hora das 7h às 19h, e uma vez de madrugada (3h30) para fechar o dia anterior.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {readError && (
          <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-foreground" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            {readError}
          </p>
        )}
        {alerta && (
          <p className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-foreground" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            {alerta.tipo === "falha"
              ? "A sincronização falhou duas vezes seguidas. Veja o erro na lista abaixo."
              : `A sincronização não conclui há mais de ${MINUTOS_SEM_SUCESSO_PARA_ALERTA} minutos (${alerta.minutos} min).`}
          </p>
        )}

        <div className="flex items-center justify-between gap-4 rounded-lg ellos-inset p-4">
          <div>
            <p className="font-medium text-foreground">Agendador automático</p>
            <p className="text-sm text-muted-foreground">
              {enabled ? "Ligado: roda sozinho nos horários acima (de hora em hora, no minuto 0)." : "Desligado: nada roda sozinho. Você ainda pode simular e sincronizar à mão."}
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={!loaded || ocupado !== null}
            aria-label="Agendador automático"
            onCheckedChange={(ligar) => (ligar ? setConfirmar("ligar") : void mudarAgendador(false))}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled={ocupado !== null} onClick={() => void simularHoje()}>
            {ocupado === "simular" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
            Simular hoje
          </Button>
          <Button disabled={ocupado !== null} onClick={() => setConfirmar("manual")}>
            {ocupado === "manual" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sincronizar hoje agora
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">{atualizadoTexto ?? "Ainda sem nenhuma sincronização concluída"}</span>
        </div>
        <p className="text-xs text-muted-foreground" data-testid="sync-tempo-real">
          {tempoReal === "ativo"
            ? "Tempo real ativo: as telas se atualizam sozinhas assim que a sincronização grava."
            : tempoReal === "conectando"
              ? "Conectando ao tempo real…"
              : "Tempo real indisponível agora: as telas se atualizam a cada 5 minutos e ao voltar para a aba."}
        </p>

        {simulacao && (
          <div className="rounded-lg border border-border p-3 text-sm" data-testid="sync-simulacao">
            <p className="font-medium text-foreground">Simulação de hoje (nada foi gravado)</p>
            {simulacao.planos.map((p) => (
              <p key={p.dia} className="mt-1 text-muted-foreground tabular-nums">
                {diaMesSp(`${p.dia}T12:00:00Z`)}: ligação {fmt(p.resumo.linhasLigacao)} linhas ({fmt(p.resumo.atendimentosLigacao)} atend.) · WhatsApp{" "}
                {fmt(p.resumo.linhasWhatsapp)} linhas ({fmt(p.resumo.atendimentosWhatsapp)} atend.)
              </p>
            ))}
            <p className="mt-1 text-xs text-muted-foreground">
              {fmt(simulacao.totais.loginEsvaziado)} com login desconsiderado · {fmt(simulacao.totais.semVinculoComAtendimento)} agente(s) com atendimento e sem vínculo
            </p>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Últimas execuções</p>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{loaded ? "Nenhuma execução registrada ainda." : "Carregando…"}</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border text-sm" data-testid="sync-runs">
              {runs.slice(0, 10).map((r) => (
                <li key={r.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-3 py-2">
                  <span className="flex w-28 items-center gap-1.5 tabular-nums text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {diaMesSp(r.startedAt)} {horaSp(r.startedAt)}
                  </span>
                  <span className="w-32 text-foreground">
                    {MODE_LABEL[r.mode]}
                    <span className="ml-1 text-xs text-muted-foreground">({r.triggeredBy === "agendador" ? "agendador" : "pessoa"})</span>
                  </span>
                  <span className="w-16 tabular-nums text-muted-foreground">{diasDaExecucao(r)}</span>
                  <span
                    className={cn(
                      "flex w-28 items-center gap-1.5 font-medium",
                      r.status === "ok" ? "text-success" : r.status === "erro" ? "text-danger" : "text-muted-foreground"
                    )}
                  >
                    {r.status === "ok" ? <CheckCircle2 className="h-3.5 w-3.5" /> : r.status === "erro" ? <AlertTriangle className="h-3.5 w-3.5" /> : null}
                    {STATUS_LABEL[r.status]}
                  </span>
                  <span className="min-w-0 flex-1 text-muted-foreground">{resumoDaExecucao(r)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>

      <AlertDialog open={confirmar !== null} onOpenChange={(aberto) => !aberto && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmar === "ligar" ? "Ligar o agendador automático?" : "Sincronizar hoje agora?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar === "ligar"
                ? "A partir de agora o Ellos busca os relatórios na Escallo sozinho, de hora em hora das 7h às 19h (segunda a sábado), e fecha o dia anterior às 3h30. Você pode desligar aqui a qualquer momento."
                : "Busca hoje na Escallo e grava no Ellos agora. Linhas vindas de planilha ou lançadas à mão não são sobrescritas. Rodar de novo só atualiza o dia."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const acao = confirmar;
                setConfirmar(null);
                if (acao === "ligar") void mudarAgendador(true);
                else void sincronizarAgora();
              }}
            >
              {confirmar === "ligar" ? "Ligar" : "Sincronizar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
