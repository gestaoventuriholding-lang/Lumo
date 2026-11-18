import { describe, expect, it } from "vitest";
import { janelaDeBusca, resumoFilas, serieAnalisesImagem, type FilaDia } from "./filasMetrics";

// Dados inventados.
const f = (date: string, channel: FilaDia["channel"], area: FilaDia["area"], answered: number, abandoned: number, waitSecondsTotal: number): FilaDia => ({
  date, channel, area, answered, abandoned, waitSecondsTotal,
});

const rows: FilaDia[] = [
  f("2026-11-02", "Ligação", "analises", 10, 2, 200),
  f("2026-11-02", "Ligação", "imagem", 30, 8, 900),
  f("2026-11-02", "Ligação", "outros", 20, 0, 400),
  f("2026-11-02", "WhatsApp", "total", 100, 0, 100 * 1800),
  f("2026-11-03", "Ligação", "imagem", 20, 0, 200),
  f("2026-10-30", "Ligação", "imagem", 50, 10, 1000), // fora do período
];
const periodo = { start: "2026-11-01", end: "2026-11-30" };

describe("filas: resumo do período", () => {
  const r = resumoFilas(rows, periodo);

  it("TME por canal e geral é média ponderada pelos atendimentos", () => {
    expect(r.tmeLigacao).toBeCloseTo((200 + 900 + 400 + 200) / (10 + 30 + 20 + 20), 5);
    expect(r.tmeWhatsapp).toBe(1800);
    expect(r.tmeGeral).toBeCloseTo((1700 + 180000) / (80 + 100), 5);
  });

  it("Análises e Imagem contam só ligações atendidas; abandono só de ligação", () => {
    expect(r.analises).toBe(10);
    expect(r.imagem).toBe(50);
    expect(r.ligacoesAtendidas).toBe(80);
    expect(r.ligacoesAbandonadas).toBe(10);
    expect(r.abandonoPct).toBeCloseTo((10 / 90) * 100, 5);
  });

  it("período sem dados não inventa número", () => {
    const vazio = resumoFilas(rows, { start: "2026-12-01", end: "2026-12-31" });
    expect(vazio).toMatchObject({ temDados: false, analises: 0, imagem: 0 });
    expect(vazio.tmeGeral).toBeUndefined();
    expect(vazio.abandonoPct).toBeUndefined();
  });

  it("sem WhatsApp, o TME geral é o da ligação", () => {
    const so = resumoFilas(rows.filter((x) => x.channel === "Ligação"), periodo);
    expect(so.tmeWhatsapp).toBeUndefined();
    expect(so.tmeGeral).toBeCloseTo(so.tmeLigacao!, 5);
  });
});

describe("filas: gráfico Análises × Imagem", () => {
  it("um ponto por dia com ligações, em ordem, sem WhatsApp nem 'outros'", () => {
    const s = serieAnalisesImagem(rows, periodo);
    expect(s).toEqual([
      { date: "2026-11-02", label: "02/11", analises: 10, imagem: 30 },
      { date: "2026-11-03", label: "03/11", analises: 0, imagem: 20 },
    ]);
  });
});

describe("filas: janela de busca", () => {
  it("cobre o período e o anterior numa consulta só", () => {
    expect(janelaDeBusca({ start: "2026-11-01", end: "2026-11-30" }, { start: "2026-10-01", end: "2026-10-31" })).toEqual({ start: "2026-10-01", end: "2026-11-30" });
  });
});
