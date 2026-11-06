import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Banco do Ellos (Supabase). A chave é a PUBLICÁVEL: feita para ficar no navegador; quem protege os dados é o RLS.
 *
 * AMBIENTES (regra: teste nunca encosta na produção):
 *  - produção: só nos endereços oficiais abaixo. Usa as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY e,
 *    se não existirem, o banco de produção (para o site oficial nunca ficar sem banco).
 *  - qualquer outro endereço (teste, previews, localhost): usa SÓ as variáveis do ambiente. Sem elas, NÃO cai na produção:
 *    o app avisa "banco não configurado" e não faz nenhuma chamada ao banco de produção.
 */
const URL_PRODUCAO = "https://uvhweshxiexbrjcqgvnu.supabase.co";
const CHAVE_PRODUCAO = "sb_publishable_sk4LjYThUic5YanCIhHK-g_Tu8JIstR";
export const HOSTS_PRODUCAO: readonly string[] = [
  "ellos.venturiholding.com.br",
  "lumo.venturiholding.com.br",
  "lumo-lyart.vercel.app",
];

export type Ambiente = "producao" | "teste";

export function ambienteDoEndereco(hostname: string): Ambiente {
  return HOSTS_PRODUCAO.includes(hostname) ? "producao" : "teste";
}

export function escolherBanco(
  hostname: string,
  env: { url?: string; key?: string }
): { ambiente: Ambiente; url: string; key: string; configurado: boolean } {
  const ambiente = ambienteDoEndereco(hostname);
  if (ambiente === "producao") {
    return { ambiente, url: env.url || URL_PRODUCAO, key: env.key || CHAVE_PRODUCAO, configurado: true };
  }
  // fora da produção: nunca usa o banco de produção por padrão
  const configurado = Boolean(env.url && env.key) && env.url !== URL_PRODUCAO;
  return {
    ambiente,
    // endereço reservado (.invalid): qualquer chamada falha sem tocar em banco nenhum
    url: configurado ? (env.url as string) : "https://banco-de-teste-nao-configurado.invalid",
    key: configurado ? (env.key as string) : "sem-chave",
    configurado,
  };
}

const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
const escolhido = escolherBanco(hostname, {
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
});

export const ambiente: Ambiente = escolhido.ambiente;
/** false = ambiente de teste sem banco de teste configurado (o app mostra um aviso e não conversa com banco nenhum) */
export const bancoConfigurado: boolean = escolhido.configurado;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(escolhido.url, escolhido.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "ellos-auth",
      },
    });
  }
  return client;
}
