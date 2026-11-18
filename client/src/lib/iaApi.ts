// Ellos: lê o consumo de FTokens da IA por dia (ia_consumo_diario). Só leitura; quem grava é a sincronização com a Escallo.
import { getSupabase } from "@/lib/supabase";
import type { IaDia } from "@/lib/filasMetrics";

/** Consumo entre duas datas (AAAA-MM-DD, inclusivo). Se a tabela não existir ainda ou não der para ler, devolve lista vazia. */
export async function buscarConsumoIA(start: string, end: string): Promise<IaDia[]> {
  try {
    const { data, error } = await getSupabase()
      .from("ia_consumo_diario")
      .select("date, ftokens, contacts, actions")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true })
      .limit(1000);
    if (error) return [];
    return (data ?? []).map((r) => ({ date: String(r.date), ftokens: Number(r.ftokens) || 0, contatos: Number(r.contacts) || 0, acoes: Number(r.actions) || 0 }));
  } catch {
    return [];
  }
}
