import { describe, expect, it } from "vitest";
import { ambienteDoEndereco, escolherBanco } from "./supabase";

const PRODUCAO = "https://uvhweshxiexbrjcqgvnu.supabase.co";
const TESTE = { url: "https://teste-exemplo.supabase.co", key: "sb_publishable_chave_de_teste" };

describe("ambiente e banco: teste nunca encosta na produção", () => {
  it("os endereços oficiais são produção; todo o resto é teste", () => {
    for (const h of ["ellos.venturiholding.com.br", "lumo.venturiholding.com.br", "lumo-lyart.vercel.app"]) {
      expect(ambienteDoEndereco(h)).toBe("producao");
    }
    for (const h of ["teste.venturiholding.com.br", "ellos-git-teste-venturi-holding.vercel.app", "localhost", "ellos-abc123-venturi-holding.vercel.app"]) {
      expect(ambienteDoEndereco(h)).toBe("teste");
    }
  });

  it("produção sem variáveis continua usando o banco de produção (o oficial nunca fica sem banco)", () => {
    const b = escolherBanco("ellos.venturiholding.com.br", {});
    expect(b).toMatchObject({ ambiente: "producao", url: PRODUCAO, configurado: true });
  });

  it("teste com variáveis usa o banco de teste", () => {
    const b = escolherBanco("teste.venturiholding.com.br", TESTE);
    expect(b).toMatchObject({ ambiente: "teste", url: TESTE.url, key: TESTE.key, configurado: true });
  });

  it("teste SEM variáveis não cai na produção: fica não configurado e aponta para um endereço inválido", () => {
    for (const host of ["teste.venturiholding.com.br", "localhost", "ellos-git-qualquer-venturi-holding.vercel.app"]) {
      const b = escolherBanco(host, {});
      expect(b.configurado).toBe(false);
      expect(b.url).not.toContain("uvhweshxiexbrjcqgvnu");
      expect(b.url).toContain(".invalid");
    }
  });

  it("teste com a URL da produção nas variáveis (engano) também é recusado", () => {
    const b = escolherBanco("teste.venturiholding.com.br", { url: PRODUCAO, key: "sb_publishable_qualquer" });
    expect(b.configurado).toBe(false);
    expect(b.url).toContain(".invalid");
  });
});
