import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSyncStatus } from "@/contexts/SyncStatusContext";
import { executarSync } from "@/lib/syncApi";
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
      <Button
        variant="outline"
        onClick={() => void clicar()}
        disabled={atualizando}
        aria-busy={atualizando}
        className={cn("gap-2 bg-card", className)}
        data-testid="atualizar-agora"
      >
        {atualizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {atualizando ? "Atualizando…" : "Atualizar agora"}
      </Button>
      {aviso && (
        <p className="text-xs text-muted-foreground" role="status" data-testid="atualizar-agora-aviso">
          {aviso}
        </p>
      )}
    </div>
  );
}
