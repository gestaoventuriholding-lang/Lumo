import { describe, expect, it } from "vitest";
import { menuParaTabela, resumirMenu } from "../../../supabase/functions/escallo-sync/menu";
import { sincronizar, type Deps } from "../../../supabase/functions/escallo-sync/sincronizar";

// Dados inventados no formato do rel092.
const resposta = (extra: Record<string, unknown> = {}) => ({
  interacaoId: 258,
  interacao: "[ AT Principal ] 0 ME - Menu Principal",
  respostas: [
    { resposta: "Exames de Imagem", quantidade: 40 },
    { resposta: "Exames Laboratoriais", quantidade: "35" },
    { resposta: "Exames Cardiológicos", quantidade: 3 },
  ],
  naoRespondidasQtde: 4,
  total: 82,
  ...extra,
});

describe("menu do WhatsApp (rel092)", () => {
  it("conta cada opção e as respostas inválidas; aceita lista ou objeto", () => {
    const esperado = { dia: "2026-11-03", imagem: 40, laboratoriais: 35, cardiologicos: 3, invalidas: 4 };
    expect(resumirMenu("2026-11-03", [resposta()])).toEqual(esperado);
    expect(resumirMenu("2026-11-03", { "258": resposta() })).toEqual(esperado);
    expect(menuParaTabela(esperado)).toEqual({ date: "2026-11-03", imaging: 40, laboratory: 35, cardiology: 3, invalid: 4 });
  });

  it("dia sem ninguém no menu não gera linha", () => {
    expect(resumirMenu("2026-11-01", [])).toBeNull();
    expect(resumirMenu("2026-11-01", undefined)).toBeNull();
    expect(resumirMenu("2026-11-01", [resposta({ respostas: [], naoRespondidasQtde: 0 })])).toBeNull();
  });

  it("se a interação mudar ou aparecer opção nova, falha em vez de gravar número errado", () => {
    expect(() => resumirMenu("2026-11-03", [resposta({ interacao: "[ AT FDH ] 1 ME - Preparo de Exames" })])).toThrow("Menu Principal");
    expect(() => resumirMenu("2026-11-03", [resposta({ respostas: [{ resposta: "Vacinas", quantidade: 2 }] })])).toThrow("opção nova");
    expect(resumirMenu("2026-11-03", [resposta({ respostas: [{ resposta: "Vacinas", quantidade: 0 }] })])).toMatchObject({ invalidas: 4 });
  });

  function deps(extra: Partial<Deps> = {}) {
    const gravados: string[] = [];
    const d: Deps = {
      async buscarRelatorio() { return []; },
      async lerColaboradores() { return []; },
      async lerLimiteLogin() { return 43_200; },
      async aplicarDia(plano) { return { inseridas: plano.linhas.length, atualizadas: 0, puladas_manuais: 0, alertas_novos: 0 }; },
      async esperar() {},
      async buscarMenu(dia) { return { dia, imagem: 1, laboratoriais: 1, cardiologicos: 1, invalidas: 0 }; },
      async gravarMenu(m) { gravados.push(m.dia); },
      ...extra,
    };
    return { d, gravados };
  }

  it("grava junto com o dia, relê 7 dias no fechamento e não grava na simulação", async () => {
    const a = deps();
    await sincronizar(a.d, { modo: "hoje" }, "2026-11-26");
    expect(a.gravados).toEqual(["2026-11-26"]);
    const b = deps();
    const r = await sincronizar(b.d, { modo: "fechamento" }, "2026-11-26");
    expect(b.gravados).toEqual(["2026-11-25", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-23", "2026-11-24"]);
    expect(r.menu).toEqual({ dias: 6, erros: [] });
    const c = deps();
    await sincronizar(c.d, { modo: "simulacao", dias: ["2026-11-03"] }, "2026-11-26");
    expect(c.gravados).toEqual([]);
  });

  it("se o menu falhar, o dia principal continua gravado e o erro fica anotado", async () => {
    const { d } = deps({ async buscarMenu() { throw new Error("rel092 fora do ar"); } });
    const r = await sincronizar(d, { modo: "hoje" }, "2026-11-26");
    expect(r.gravou).toBe(true);
    expect(r.menu.erros).toEqual(["2026-11-26: rel092 fora do ar"]);
  });
});
