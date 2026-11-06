import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { refreshSyncedCollections } from "@/lib/cloudStore";
import { buscarEstadoSync, type SyncState } from "@/lib/syncApi";
import { avaliarSincronizacao, textoAtualizado, type AlertaSync, type SyncRun } from "@/lib/syncStatus";

/** A cada quanto tempo a tela confere a sincronização e traz os dados novos (e ao voltar para a aba) */
export const INTERVALO_ATUALIZACAO_MS = 5 * 60_000;

interface SyncStatusValue {
  runs: SyncRun[];
  /** Chave geral do agendador */
  enabled: boolean;
  /** true depois da primeira leitura (com ou sem sucesso) */
  loaded: boolean;
  /** Mensagem se não deu para ler o estado da sincronização (a tela segue funcionando sem ele) */
  readError: string | null;
  alerta: AlertaSync | null;
  /** "Atualizado às 14:30", ou null se nunca sincronizou */
  atualizadoTexto: string | null;
  /** Lê de novo as execuções e traz do banco os dados novos */
  refresh: () => Promise<void>;
}

const SyncStatusContext = createContext<SyncStatusValue | null>(null);

export function SyncStatusProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SyncState>({ runs: [], enabled: false });
  const [loaded, setLoaded] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => new Date());
  const rodando = useRef(false);

  const refresh = useCallback(async () => {
    if (rodando.current) return;
    rodando.current = true;
    try {
      setState(await buscarEstadoSync());
      setReadError(null);
    } catch (e) {
      setReadError(e instanceof Error ? e.message : "Não consegui ler a sincronização.");
    } finally {
      setLoaded(true);
      setAgora(new Date());
    }
    try {
      await refreshSyncedCollections();
    } catch {
      /* sem rede agora: a próxima volta tenta de novo; os dados da tela continuam os de antes */
    }
    rodando.current = false;
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), INTERVALO_ATUALIZACAO_MS);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [refresh]);

  const value = useMemo<SyncStatusValue>(
    () => ({
      runs: state.runs,
      enabled: state.enabled,
      loaded,
      readError,
      alerta: avaliarSincronizacao(state.runs, state.enabled, agora),
      atualizadoTexto: textoAtualizado(state.runs, agora),
      refresh,
    }),
    [state, loaded, readError, agora, refresh]
  );
  return <SyncStatusContext.Provider value={value}>{children}</SyncStatusContext.Provider>;
}

/** Fora do provider (testes das telas) devolve um estado vazio, sem erro */
export function useSyncStatus(): SyncStatusValue {
  return (
    useContext(SyncStatusContext) ?? {
      runs: [],
      enabled: false,
      loaded: true,
      readError: null,
      alerta: null,
      atualizadoTexto: null,
      refresh: async () => {},
    }
  );
}
