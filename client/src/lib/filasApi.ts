// Ellos: lê os totais de fila (queue_daily). Só leitura; quem grava é a sincronização com a Escallo.
import { getSupabase } from "@/lib/supabase";
import type { FilaDia } from "@/lib/filasMetrics";

/** Totais de fila entre duas datas (AAAA-MM-DD, inclusivo). Se a tabela não existir ainda ou não der para ler, devolve lista vazia. */
export async function buscarFilasDiarias(start: string, end: string): Promise<FilaDia[]> {
  try {
    const supabase = getSupabase();
    const rows: FilaDia[] = [];
    const pagina = 1000;
    for (let de = 0; ; de += pagina) {
      const { data, error } = await supabase
        .from("queue_daily")
        .select("date, channel, area, answered, abandoned, wait_seconds_total")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true })
        .range(de, de + pagina - 1);
      if (error) return [];
      for (const r of data ?? []) {
        rows.push({
          date: String(r.date),
          channel: r.channel === "WhatsApp" ? "WhatsApp" : "Ligação",
          area: r.area,
          answered: Number(r.answered) || 0,
          abandoned: Number(r.abandoned) || 0,
          waitSecondsTotal: Number(r.wait_seconds_total) || 0,
        });
      }
      if (!data || data.length < pagina) break;
    }
    return rows;
  } catch {
    return [];
  }
}
