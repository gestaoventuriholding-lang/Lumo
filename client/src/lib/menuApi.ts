// Ellos: lê as escolhas de exame no menu do WhatsApp (exam_choices_daily). Só leitura; quem grava é a sincronização com a Escallo.
import { getSupabase } from "@/lib/supabase";
import type { EscolhasDia } from "@/lib/filasMetrics";

/** Escolhas entre duas datas (AAAA-MM-DD, inclusivo). Se a tabela não existir ainda ou não der para ler, devolve lista vazia. */
export async function buscarEscolhasExames(start: string, end: string): Promise<EscolhasDia[]> {
  try {
    const { data, error } = await getSupabase()
      .from("exam_choices_daily")
      .select("date, imaging, laboratory, cardiology")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true })
      .limit(1000);
    if (error) return [];
    return (data ?? []).map((r) => ({ date: String(r.date), imagem: Number(r.imaging) || 0, analises: Number(r.laboratory) || 0, cardiologicos: Number(r.cardiology) || 0 }));
  } catch {
    return [];
  }
}
