import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Projeto "lumo" no Supabase (conta amanda.silva@venturiholding.com.br).
 *
 * A chave abaixo é a chave PUBLICÁVEL: ela foi feita para ficar no navegador.
 * Quem protege os dados é o RLS do banco (cada usuário só vê o que é dele,
 * e o admin vê tudo). Para trocar de projeto, defina VITE_SUPABASE_URL e
 * VITE_SUPABASE_PUBLISHABLE_KEY nas variáveis de ambiente da Vercel.
 */
const DEFAULT_URL = "https://uvhweshxiexbrjcqgvnu.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_sk4LjYThUic5YanCIhHK-g_Tu8JIstR";

const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "lumo-auth",
      },
    });
  }
  return client;
}
