// Ellos: lê os orçamentos para o Follow-up e grava o acompanhamento. Quem cria as linhas é a sincronização com a Escallo.
// Não passa pelo cloudStore: são milhares de linhas por mês, buscadas só quando a tela abre.
import { getSupabase } from "@/lib/supabase";
import type { FollowUp } from "@/types/followUp";

const COLUNAS = "id, protocol, date, area, attendant_id, attendant_name, status, decline_reason, note, next_contact_on, attempts, last_contact_at, handled_by";
const PAGINA = 1000; // máximo que o Supabase devolve por vez

export const MENSAGEM_ERRO_LEITURA = "Não consegui ler os orçamentos. Confira a internet e tente de novo.";
export const MENSAGEM_ERRO_GRAVACAO = "Não consegui salvar o contato. Confira a internet e tente de novo.";

type Linha = Record<string, unknown>;

export function deLinha(r: Linha): FollowUp {
  return {
    id: Number(r.id),
    protocol: String(r.protocol),
    date: String(r.date),
    area: r.area as FollowUp["area"],
    attendantId: r.attendant_id === null || r.attendant_id === undefined ? null : Number(r.attendant_id),
    attendantName: String(r.attendant_name ?? ""),
    status: r.status as FollowUp["status"],
    declineReason: (r.decline_reason ?? null) as FollowUp["declineReason"],
    note: String(r.note ?? ""),
    nextContactOn: r.next_contact_on ? String(r.next_contact_on) : null,
    attempts: Number(r.attempts) || 0,
    lastContactAt: r.last_contact_at ? String(r.last_contact_at) : null,
    handledBy: String(r.handled_by ?? ""),
  };
}

/** Orçamentos entre duas datas (AAAA-MM-DD, inclusivo) */
export async function buscarFollowUps(start: string, end: string): Promise<FollowUp[]> {
  const todas: FollowUp[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await getSupabase()
      .from("quote_followups")
      .select(COLUNAS)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false })
      .order("id", { ascending: false })
      .range(de, de + PAGINA - 1);
    if (error) throw new Error(MENSAGEM_ERRO_LEITURA);
    todas.push(...((data ?? []) as Linha[]).map(deLinha));
    if ((data?.length ?? 0) < PAGINA) return todas;
  }
}

/** Dia do orçamento mais recente guardado (tela Relatórios). Null se não houver ou não der para ler. */
export async function ultimoDiaDeOrcamento(): Promise<string | null> {
  try {
    const { data, error } = await getSupabase().from("quote_followups").select("date").order("date", { ascending: false }).limit(1);
    return error || !data?.[0] ? null : String(data[0].date);
  } catch {
    return null;
  }
}

export async function salvarFollowUp(f: FollowUp): Promise<void> {
  const { data, error } = await getSupabase()
    .from("quote_followups")
    .update({
      status: f.status,
      decline_reason: f.declineReason,
      note: f.note,
      next_contact_on: f.nextContactOn,
      attempts: f.attempts,
      last_contact_at: f.lastContactAt,
      handled_by: f.handledBy,
    })
    .eq("id", f.id)
    .select("id");
  if (error || !data || data.length === 0) throw new Error(MENSAGEM_ERRO_GRAVACAO);
}
