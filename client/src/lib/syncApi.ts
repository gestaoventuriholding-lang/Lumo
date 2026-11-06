// Ellos: conversa com o servidor sobre a sincronização com a Escallo (ler execuções, ligar/desligar, rodar agora).
import { ambiente, getSupabase } from "@/lib/supabase";
import { traduzirErroDaFuncao } from "@/lib/escalloVinculos";
import { runFromRow, type SyncRun } from "@/lib/syncStatus";

/** No ambiente de teste a sincronização com a Escallo fica desativada (sem token e sem agendador); na produção nada muda */
export const MENSAGEM_SYNC_TESTE = "Ambiente de teste: a sincronização com a Escallo está desativada. Os dados exibidos são inventados.";
export function sincronizacaoDesativada(): boolean {
  return ambiente === "teste";
}

export interface SyncState {
  runs: SyncRun[];
  /** Chave geral do agendador (sync_config.enabled) */
  enabled: boolean;
}

/** Últimas execuções e a chave geral. A equipe toda pode ler (RLS). Falha com mensagem clara se o servidor não responder. */
export async function buscarEstadoSync(): Promise<SyncState> {
  const supabase = getSupabase();
  const [runs, config] = await Promise.all([
    supabase.from("sync_runs").select("*").order("started_at", { ascending: false }).limit(30),
    supabase.from("sync_config").select("enabled").maybeSingle(),
  ]);
  if (runs.error) throw new Error("Não consegui ler as execuções da sincronização. Tente de novo em instantes.");
  return {
    runs: (runs.data ?? []).map((r) => runFromRow(r as Record<string, unknown>)),
    enabled: config.data?.enabled === true,
  };
}

/** Liga ou desliga o agendador. Só administrador (o banco recusa os outros). */
export async function definirAgendadorAtivo(ativo: boolean): Promise<void> {
  const { error } = await getSupabase().rpc("sync_definir_ativo", { p_ativo: ativo });
  if (error) {
    throw new Error(/apenas administrador/i.test(error.message) ? "Só administrador pode ligar ou desligar a sincronização." : "Não consegui mudar o agendador. Tente de novo.");
  }
}

export interface RespostaSync {
  ok: boolean;
  modo: string;
  gravou: boolean;
  dias: string[];
  gravacao: { inseridas: number; atualizadas: number; puladas_manuais: number; alertas_novos: number };
  totais: { loginEsvaziado: number; semVinculoComAtendimento: number };
  planos: { dia: string; resumo: { linhasLigacao: number; linhasWhatsapp: number; atendimentosLigacao: number; atendimentosWhatsapp: number } }[];
}

/**
 * Pede à função escallo-sync uma simulação (não grava) ou uma execução manual (só administrador),
 * ou "agora" (qualquer pessoa da equipe: hoje, no máximo 1 vez a cada 5 minutos).
 */
export async function executarSync(modo: "simulacao" | "manual" | "agora", dias: string[] = []): Promise<RespostaSync> {
  // teste: nem chama a função (que não tem token da Escallo) e explica o motivo
  if (sincronizacaoDesativada()) throw new Error(MENSAGEM_SYNC_TESTE);
  const body = modo === "agora" ? { modo } : { modo, dias };
  const { data, error } = await getSupabase().functions.invoke("escallo-sync", { body });
  if (error) throw new Error((await traduzirErroDaFuncao(error)).replace("escallo-rel025", "escallo-sync"));
  const r = data as RespostaSync | { pulado?: string } | null;
  if (r && "pulado" in r && r.pulado) throw new Error(`A sincronização não rodou: ${r.pulado}.`);
  if (!r || !("planos" in r) || !Array.isArray(r.planos)) throw new Error("A resposta da sincronização veio em um formato inesperado.");
  return r;
}
