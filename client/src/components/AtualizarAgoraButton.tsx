import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSyncStatus } from "@/contexts/SyncStatusContext";
import { MENSAGEM_SYNC_TESTE, executarSync, sincronizacaoDesativada } from "@/lib/syncApi";
import { limiteAtualizarAgora } from "@/lib/syncStatus";
import { cn } from "@/lib/utils";

/**
 * Dashboard: "Atualizar agora". Sincroniza o dia de hoje com a Escallo na hora, para qualquer pessoa da equipe.
 * No máximo 1 atualização a cada 5 minutos (de qualquer origem): quem clica antes vê "Atualizado há X minutos. Tente de novo em Y."
 * A tela confere antes de chamar; quem realmente impede é a função no servidor.
 */
export default function AtualizarAgoraButton({ className }: { className?: string }) {
  const { runs, refresh } = useSyncStatus();
  const [atualizando, setAtualizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const desativado = sincronizacaoDesativada();

  const clicar = async () => {
    const limite = limiteAtualizarAgora(runs);
    if (limite) {
      setAviso(limite.mensagem);
      return;
    }
    setAviso(null);
    setAtualizando(true);
    try {
      await executarSync("agora");
      await refresh();
      toast.success("Dados de hoje atualizados", { id: "atualizar-agora", duration: 3000 });
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : "Não consegui atualizar agora.";
      // o servidor também impede: mostra o mesmo aviso, sem tratar como erro
      if (/^Atualizado há/.test(mensagem)) setAviso(mensagem);
      else toast.error(mensagem);
      await refresh();
    } finally {
      setAtualizando(false);
    }
  };

  return (
    <div className="flex flex-col items-stretch gap-1 sm:items-end">
      {/* o balão fica no invólucro: botão desabilitado não recebe o mouse */}
      <span title={desativado ? MENSAGEM_SYNC_TESTE : undefined} className="inline-flex" data-testid="atualizar-agora-envolucro">
        <Button
          variant="outline"
          onClick={() => void clicar()}
          disabled={atualizando || desativado}
          aria-busy={atualizando}
          aria-describedby={desativado ? "atualizar-agora-motivo" : undefined}
          className={cn("gap-2 bg-card", className)}
          data-testid="atualizar-agora"
        >
          {atualizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {atualizando ? "Atualizando…" : "Atualizar agora"}
        </Button>
      </span>
      {desativado && (
        <span id="atualizar-agora-motivo" className="sr-only">
          {MENSAGEM_SYNC_TESTE}
        </span>
      )}
      {aviso && (
        <p className="text-xs text-muted-foreground" role="status" data-testid="atualizar-agora-aviso">
          {aviso}
        </p>
      )}
    </div>
  );
}
