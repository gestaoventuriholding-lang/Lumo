import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { refreshSyncedCollections } from "@/lib/cloudStore";
import { getSupabase } from "@/lib/supabase";
import { buscarEstadoSync, type SyncState } from "@/lib/syncApi";
import { avaliarSincronizacao, textoAtualizado, type AlertaSync, type SyncRun } from "@/lib/syncStatus";

/** Reserva: a cada quanto tempo a tela confere a sincronização e traz os dados novos, mesmo sem aviso do Realtime (e ao voltar para a aba) */
export const INTERVALO_ATUALIZACAO_MS = 5 * 60_000;
/** Depois de um aviso do Realtime espera um instante: a sincronização grava dezenas de linhas de uma vez e a tela atualiza uma vez só */
export const ESPERA_REALTIME_MS = 1_500;
/** Tabelas que a sincronização grava (e as execuções). O Realtime só entrega a quem passa pelas regras de acesso (RLS) da equipe. */
export const TABELAS_TEMPO_REAL = ["performance_records", "productivity_reports", "login_alerts", "sync_runs"] as const;

export type TempoReal = "conectando" | "ativo" | "reserva";

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
  /** Realtime: ativo = as telas se atualizam sozinhas; reserva = usando só a atualização de 5 em 5 minutos */
  tempoReal: TempoReal;
  /** Lê de novo as execuções e traz do banco os dados novos */
  refresh: () => Promise<void>;
}

const SyncStatusContext = createContext<SyncStatusValue | null>(null);

export function SyncStatusProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SyncState>({ runs: [], enabled: false });
  const [loaded, setLoaded] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => new Date());
  const [tempoReal, setTempoReal] = useState<TempoReal>("conectando");
  const rodando = useRef(false);
  const pedidoDuranteExecucao = useRef(false);

  const refresh = useCallback(async () => {
    // Se chegar outro pedido enquanto roda, roda mais uma vez no fim (não perde o último aviso)
    if (rodando.current) {
      pedidoDuranteExecucao.current = true;
      return;
    }
    rodando.current = true;
    try {
      do {
        pedidoDuranteExecucao.current = false;
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
      } while (pedidoDuranteExecucao.current);
    } finally {
      rodando.current = false;
    }
  }, []);

  // Reserva: de 5 em 5 minutos e ao voltar para a aba
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

  // Tempo real: o servidor avisa quando a sincronização (ou alguém da equipe) grava; a tela atualiza sozinha
  useEffect(() => {
    let espera: number | undefined;
    const aoMudar = () => {
      window.clearTimeout(espera);
      espera = window.setTimeout(() => void refresh(), ESPERA_REALTIME_MS);
    };
    let canal: ReturnType<ReturnType<typeof getSupabase>["channel"]> | null = null;
    try {
      const supabase = getSupabase();
      canal = supabase.channel("ellos-sincronizacao");
      for (const table of TABELAS_TEMPO_REAL) canal.on("postgres_changes", { event: "*", schema: "public", table }, aoMudar);
      canal.subscribe((status) => {
        if (status === "SUBSCRIBED") setTempoReal("ativo");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setTempoReal("reserva");
      });
    } catch {
      setTempoReal("reserva");
    }
    return () => {
      window.clearTimeout(espera);
      if (canal) void getSupabase().removeChannel(canal);
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
      tempoReal,
      refresh,
    }),
    [state, loaded, readError, agora, tempoReal, refresh]
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
      tempoReal: "reserva",
      refresh: async () => {},
    }
  );
}
