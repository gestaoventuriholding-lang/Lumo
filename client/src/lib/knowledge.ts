// Ellos: Base de conhecimento. Regras puras (validação, busca, categorias), sem tela e sem banco.

export const KNOWLEDGE_TITLE_MAX = 120;
export const KNOWLEDGE_CATEGORY_MAX = 40;
export const KNOWLEDGE_CONTENT_MAX = 20000;

export interface KnowledgeArticle {
  id: number;
  title: string;
  category: string | null;
  content: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeInput {
  title: string;
  category: string;
  content: string;
}

/** Mensagem de erro (diz o que houve e como resolver) ou null se estiver tudo certo */
export function validateKnowledge(input: KnowledgeInput): string | null {
  const title = input.title.trim();
  const category = input.category.trim();
  const content = input.content.trim();
  if (!title) return "Escreva o título do conhecimento.";
  if (title.length > KNOWLEDGE_TITLE_MAX) return `O título pode ter até ${KNOWLEDGE_TITLE_MAX} caracteres. Encurte o título.`;
  if (category.length > KNOWLEDGE_CATEGORY_MAX) return `A categoria pode ter até ${KNOWLEDGE_CATEGORY_MAX} caracteres. Use um nome mais curto.`;
  if (!content) return "Escreva o conteúdo do conhecimento.";
  if (content.length > KNOWLEDGE_CONTENT_MAX) return `O conteúdo pode ter até ${KNOWLEDGE_CONTENT_MAX.toLocaleString("pt-BR")} caracteres. Divida em dois conhecimentos.`;
  return null;
}

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
const normalizar = (t: string) => semAcento(t).toLowerCase();

/** Busca (título, categoria e texto, sem diferenciar acento ou maiúscula) e filtro de categoria. Mais recentes primeiro. */
export function filterKnowledge(items: KnowledgeArticle[], busca: string, categoria: string): KnowledgeArticle[] {
  const termos = normalizar(busca).split(/\s+/).filter(Boolean);
  return items
    .filter((a) => !categoria || (a.category ?? "") === categoria)
    .filter((a) => {
      if (termos.length === 0) return true;
      const texto = normalizar(`${a.title} ${a.category ?? ""} ${a.content}`);
      return termos.every((t) => texto.includes(t));
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id);
}

/** Categorias já usadas, em ordem alfabética */
export function knowledgeCategories(items: KnowledgeArticle[]): string[] {
  return [...new Set(items.map((a) => a.category).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
