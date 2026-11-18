import { describe, expect, it } from "vitest";
import {
  KNOWLEDGE_CONTENT_MAX,
  KNOWLEDGE_TITLE_MAX,
  filterKnowledge,
  knowledgeCategories,
  validateKnowledge,
  type KnowledgeArticle,
} from "./knowledge";

// Dados inventados.
const a = (id: number, title: string, category: string | null, content: string, updatedAt: string): KnowledgeArticle => ({
  id, title, category, content, createdByEmail: "", createdAt: updatedAt, updatedAt,
});
const itens = [
  a(1, "Preparo para ressonância", "Imagem", "Jejum de 4 horas. Avisar sobre implantes metálicos.", "2026-11-10T10:00:00Z"),
  a(2, "Coleta domiciliar", "Laboratório", "Agendar com 24 horas de antecedência.", "2026-11-12T10:00:00Z"),
  a(3, "Orientação sem categoria", null, "Texto livre sobre ressonância magnética.", "2026-11-11T10:00:00Z"),
];

describe("base de conhecimento: validação", () => {
  const ok = { title: "Título", category: "Imagem", content: "Texto" };
  it("aceita um conhecimento completo e a categoria vazia", () => {
    expect(validateKnowledge(ok)).toBeNull();
    expect(validateKnowledge({ ...ok, category: "  " })).toBeNull();
  });
  it("pede título e conteúdo, ignorando espaços", () => {
    expect(validateKnowledge({ ...ok, title: "   " })).toContain("título");
    expect(validateKnowledge({ ...ok, content: " \n " })).toContain("conteúdo");
  });
  it("respeita os limites e diz como resolver", () => {
    expect(validateKnowledge({ ...ok, title: "x".repeat(KNOWLEDGE_TITLE_MAX + 1) })).toContain("Encurte");
    expect(validateKnowledge({ ...ok, category: "x".repeat(41) })).toContain("mais curto");
    expect(validateKnowledge({ ...ok, content: "x".repeat(KNOWLEDGE_CONTENT_MAX + 1) })).toContain("Divida");
    expect(validateKnowledge({ ...ok, content: "x".repeat(KNOWLEDGE_CONTENT_MAX) })).toBeNull();
  });
});

describe("base de conhecimento: busca e categorias", () => {
  it("sem filtro, mostra todos do mais recente para o mais antigo", () => {
    expect(filterKnowledge(itens, "", "").map((x) => x.id)).toEqual([2, 3, 1]);
  });
  it("busca em título, categoria e texto, sem diferenciar acento nem maiúscula", () => {
    expect(filterKnowledge(itens, "RESSONANCIA", "").map((x) => x.id)).toEqual([3, 1]);
    expect(filterKnowledge(itens, "laboratorio", "").map((x) => x.id)).toEqual([2]);
    expect(filterKnowledge(itens, "jejum implantes", "").map((x) => x.id)).toEqual([1]);
    expect(filterKnowledge(itens, "nada disso", "")).toEqual([]);
  });
  it("filtra por categoria e junta com a busca", () => {
    expect(filterKnowledge(itens, "", "Imagem").map((x) => x.id)).toEqual([1]);
    expect(filterKnowledge(itens, "ressonancia", "Imagem").map((x) => x.id)).toEqual([1]);
    expect(filterKnowledge(itens, "coleta", "Imagem")).toEqual([]);
  });
  it("lista as categorias usadas, sem repetir nem vazias, em ordem alfabética", () => {
    expect(knowledgeCategories([...itens, a(4, "Outro", "Imagem", "x", "2026-11-01T00:00:00Z")])).toEqual(["Imagem", "Laboratório"]);
  });
});
