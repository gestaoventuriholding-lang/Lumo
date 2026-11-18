// Ellos: lê e grava a Base de conhecimento (tabela knowledge_articles). RLS: a equipe lê, cria e edita; só o administrador apaga.
import { getSupabase } from "@/lib/supabase";
import type { KnowledgeArticle, KnowledgeInput } from "@/lib/knowledge";

const COLUNAS = "id, title, category, content, created_by_email, created_at, updated_at";

interface Linha {
  id: number;
  title: string;
  category: string | null;
  content: string;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}

const deLinha = (r: Linha): KnowledgeArticle => ({
  id: Number(r.id),
  title: r.title,
  category: r.category,
  content: r.content,
  createdByEmail: r.created_by_email ?? "",
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const paraLinha = (i: KnowledgeInput) => ({ title: i.title.trim(), category: i.category.trim() || null, content: i.content.trim() });

export async function listarConhecimentos(): Promise<KnowledgeArticle[]> {
  const { data, error } = await getSupabase().from("knowledge_articles").select(COLUNAS).order("updated_at", { ascending: false }).limit(2000);
  if (error) throw new Error("Não consegui carregar a base de conhecimento. Recarregue a página; se continuar, avise a Amanda.");
  return (data ?? []).map((r) => deLinha(r as Linha));
}

export async function criarConhecimento(input: KnowledgeInput): Promise<KnowledgeArticle> {
  const { data, error } = await getSupabase().from("knowledge_articles").insert(paraLinha(input)).select(COLUNAS).single();
  if (error || !data) throw new Error("Não consegui salvar o conhecimento. Tente de novo.");
  return deLinha(data as Linha);
}

export async function atualizarConhecimento(id: number, input: KnowledgeInput): Promise<KnowledgeArticle> {
  const { data, error } = await getSupabase().from("knowledge_articles").update(paraLinha(input)).eq("id", id).select(COLUNAS).single();
  if (error || !data) throw new Error("Não consegui salvar as mudanças. Tente de novo.");
  return deLinha(data as Linha);
}

export async function excluirConhecimento(id: number): Promise<void> {
  const { error } = await getSupabase().from("knowledge_articles").delete().eq("id", id);
  if (error) throw new Error("Não consegui excluir o conhecimento. Só administradores podem excluir.");
}
