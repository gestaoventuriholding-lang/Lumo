import { describe, expect, it } from "vitest";
import { IA_FTOKENS_CONTRATADOS, franquiaDoMes, janelaDeBusca, mesDaData, resumoExames, resumoFilas, resumoIA, serieExames, type FilaDia, type IaDia } from "./filasMetrics";

// Dados inventados.
const f = (date: string, channel: FilaDia["channel"], area: FilaDia["area"], answered: number, abandoned: number, waitSecondsTotal: number): FilaDia => ({
  date, channel, area, answered, abandoned, waitSecondsTotal,
});

const rows: FilaDia[] = [
  f("2026-11-02", "Ligação", "analises", 10, 2, 200),
  f("2026-11-02", "Ligação", "imagem", 30, 8, 900),
  f("2026-11-02", "Ligação", "cardiologicos", 5, 1, 100),
  f("2026-11-02", "Ligação", "outros", 20, 0, 400),
  f("2026-11-02", "WhatsApp", "total", 100, 0, 100 * 1800),
  f("2026-11-03", "Ligação", "imagem", 20, 0, 200),
  f("2026-10-30", "Ligação", "imagem", 50, 10, 1000), // fora do período
];
const periodo = { start: "2026-11-01", end: "2026-11-30" };

describe("filas: resumo do período", () => {
  const r = resumoFilas(rows, periodo);

  it("TME por canal e geral é média ponderada pelos atendimentos", () => {
    expect(r.tmeLigacao).toBeCloseTo((200 + 900 + 100 + 400 + 200) / (10 + 30 + 5 + 20 + 20), 5);
    expect(r.tmeWhatsapp).toBe(1800);
    expect(r.tmeGeral).toBeCloseTo((1800 + 180000) / (85 + 100), 5);
  });

  it("Análises e Imagem contam só ligações atendidas; abandono só de ligação", () => {
    expect(r.analises).toBe(10);
    expect(r.imagem).toBe(50);
    expect(r.cardiologicos).toBe(5);
    expect(r.outras).toBe(20);
    expect(r.ligacoesAtendidas).toBe(85);
    expect(r.ligacoesAbandonadas).toBe(11);
    expect(r.abandonoPct).toBeCloseTo((11 / 96) * 100, 5);
  });

  it("a soma dos 4 grupos fecha com o total de ligações atendidas", () => {
    expect(r.analises + r.imagem + r.cardiologicos + r.outras).toBe(r.ligacoesAtendidas);
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

describe("exames: escolhas no menu do WhatsApp", () => {
  const escolhas = [
    { date: "2026-11-03", analises: 7, imagem: 9, cardiologicos: 1 },
    { date: "2026-11-02", analises: 10, imagem: 30, cardiologicos: 5 },
    { date: "2026-11-08", analises: 0, imagem: 0, cardiologicos: 0 }, // domingo sem movimento
    { date: "2026-10-30", analises: 99, imagem: 99, cardiologicos: 99 }, // fora do período
  ];

  it("soma só o período", () => {
    expect(resumoExames(escolhas, periodo)).toEqual({ analises: 17, imagem: 39, cardiologicos: 6 });
  });

  it("gráfico: um ponto por dia com escolhas, em ordem de data", () => {
    expect(serieExames(escolhas, periodo)).toEqual([
      { date: "2026-11-02", label: "02/11", analises: 10, imagem: 30, cardiologicos: 5 },
      { date: "2026-11-03", label: "03/11", analises: 7, imagem: 9, cardiologicos: 1 },
    ]);
  });
});

describe("filas: janela de busca", () => {
  it("cobre o período e o anterior numa consulta só", () => {
    expect(janelaDeBusca({ start: "2026-11-01", end: "2026-11-30" }, { start: "2026-10-01", end: "2026-10-31" })).toEqual({ start: "2026-10-01", end: "2026-11-30" });
  });
});

describe("filas: consumo de IA (FTokens)", () => {
  const d = (date: string, ftokens: number, contatos: number): IaDia => ({ date, ftokens, contatos, acoes: contatos });
  const dias = [d("2026-11-02", 100, 80), d("2026-11-03", 300, 240), d("2026-10-30", 50, 40)];

  it("soma só o período e calcula FTokens por contato", () => {
    const r = resumoIA(dias, { start: "2026-11-01", end: "2026-11-30" });
    expect(r).toMatchObject({ temDados: true, ftokens: 400, contatos: 320 });
    expect(r.mediaPorContato).toBeCloseTo(1.25, 5);
  });

  it("período sem dados não inventa número", () => {
    const r = resumoIA(dias, { start: "2026-12-01", end: "2026-12-31" });
    expect(r).toMatchObject({ temDados: false, ftokens: 0, contatos: 0 });
    expect(r.mediaPorContato).toBeUndefined();
  });

  it("mês da data: primeiro e último dia (inclusive fevereiro)", () => {
    expect(mesDaData("2026-11-17")).toEqual({ start: "2026-11-01", end: "2026-11-30" });
    expect(mesDaData("2026-02-03")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });

  it("franquia do mês: acumula do dia 1 até o fim do período, mesmo com o filtro de um dia só", () => {
    const f = franquiaDoMes(dias, { start: "2026-11-03", end: "2026-11-03" });
    expect(f.usado).toBe(400);
    expect(f.pct).toBeCloseTo((400 / IA_FTOKENS_CONTRATADOS) * 100, 5);
    expect(f.esgotada).toBe(false);
  });

  it("franquia esgotada quando passa dos 5.000 contratados", () => {
    const f = franquiaDoMes([d("2026-11-03", 3000, 100), d("2026-11-12", 2028.71, 100)], { start: "2026-11-01", end: "2026-11-17" });
    expect(f.esgotada).toBe(true);
    expect(f.pct).toBeCloseTo(100.57, 1);
  });
});
