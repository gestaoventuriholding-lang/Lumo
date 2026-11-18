// Ellos: lê o auto-atendimento do robô por dia (auto_atendimento_diario). Só leitura; quem grava é a sincronização com a Escallo.
import { getSupabase } from "@/lib/supabase";
import type { AutoDia } from "@/lib/filasMetrics";

/** Totais entre duas datas (AAAA-MM-DD, inclusivo). Se a tabela não existir ainda ou não der para ler, devolve lista vazia. */
export async function buscarAutoDiario(start: string, end: string): Promise<AutoDia[]> {
  try {
    const { data, error } = await getSupabase()
      .from("auto_atendimento_diario")
      .select("date, contacts, self_served, served, no_success, errors")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true })
      .limit(1000);
    if (error) return [];
    return (data ?? []).map((r) => ({
      date: String(r.date),
      contatos: Number(r.contacts) || 0,
      autoAtendidos: Number(r.self_served) || 0,
      atendidos: Number(r.served) || 0,
      semExito: Number(r.no_success) || 0,
      comErro: Number(r.errors) || 0,
    }));
  } catch {
    return [];
  }
}
