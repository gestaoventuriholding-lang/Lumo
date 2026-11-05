import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ChartAreaGradient from "../components/ChartAreaGradient";
import {
  HEAT_STEPS,
  absenceChartColors,
  chartColors,
  chartGridProps,
  heatColor,
  heatStep,
  heatTextColor,
  trendChartKind,
} from "./chartTheme";

const SRC = join(process.cwd(), "client", "src");
const css = readFileSync(join(SRC, "index.css"), "utf8").replace(/\r\n/g, "\n");

function bloco(seletor: string): Record<string, string> {
  const inicio = css.indexOf(`\n${seletor} {`);
  const fim = css.indexOf("\n}", inicio);
  const out: Record<string, string> = {};
  for (const m of css.slice(inicio, fim).matchAll(/^\s*--([a-z0-9-]+):\s*([^;]+);/gm)) out[m[1]] = m[2].trim();
  return out;
}
const claro = bloco(":root");
const escuro = { ...claro, ...bloco(".dark") };
const resolver = (t: Record<string, string>, nome: string): string => {
  let v = t[nome];
  for (let i = 0; i < 6 && v?.startsWith("var("); i++) v = t[v.slice(6, -1).split(",")[0]];
  return v;
};
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (h: string) => {
  const [r, g, b] = rgb(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const misturar = (forte: string, fraco: string, t: number) =>
  "#" + rgb(forte).map((c, i) => Math.round(c * t + rgb(fraco)[i] * (1 - t)).toString(16).padStart(2, "0")).join("");

describe("tema dos gráficos: só variáveis do tema", () => {
  it("nenhuma cor escrita no código: tudo é var(--...)", () => {
    const todas = [
      ...chartColors.series,
      chartColors.primary, chartColors.ligacao, chartColors.whatsapp, chartColors.positive, chartColors.warning,
      chartColors.negative, chartColors.neutral, chartColors.neutralSoft,
      ...Object.values(absenceChartColors), chartGridProps.stroke,
    ];
    for (const c of todas) expect(c).toMatch(/^var\(--[a-z0-9-]+\)$/);
    expect(readFileSync(join(SRC, "lib/chartTheme.ts"), "utf8")).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
  it("cores com significado: verde bom, vermelho ruim, amarelo atenção; o laranja não é cor de alerta", () => {
    expect(chartColors.positive).toBe("var(--success)");
    expect(chartColors.negative).toBe("var(--danger)");
    expect(chartColors.warning).toBe("var(--warning-fill)");
    expect([chartColors.positive, chartColors.negative, chartColors.warning]).not.toContain(chartColors.primary);
    expect(chartColors.ligacao).toBe(chartColors.primary);
  });
  it("a grade é tracejada, só horizontal e apagada", () => {
    expect(chartGridProps).toMatchObject({ vertical: false, strokeDasharray: "4 4", stroke: "var(--chart-grid)" });
  });
});

describe("tema dos gráficos: contraste", () => {
  for (const [nome, t] of [["claro", claro], ["escuro", escuro]] as const) {
    it(`séries 1 a 4 e WhatsApp têm 3:1 sobre o cartão no modo ${nome}`, () => {
      for (const v of ["chart-1", "chart-2", "chart-3", "chart-4", "channel-whatsapp"]) {
        expect(contraste(resolver(t, v), resolver(t, "card")), `${nome}: --${v}`).toBeGreaterThanOrEqual(3);
      }
    });
    it(`ligação é laranja (saturado) e WhatsApp é cinza neutro no modo ${nome}`, () => {
      const saturacao = (h: string) => Math.max(...rgb(h)) - Math.min(...rgb(h));
      expect(saturacao(resolver(t, "chart-1"))).toBeGreaterThan(150);
      expect(saturacao(resolver(t, "channel-whatsapp"))).toBeLessThanOrEqual(40);
    });
    it(`mapa de calor: texto de cada degrau passa em 4,5:1 no modo ${nome}`, () => {
      const baixo = resolver(t, "heat-low");
      const alto = resolver(t, "heat-high");
      for (const passo of HEAT_STEPS) {
        const fundo = misturar(alto, baixo, passo);
        const textoVar = heatTextColor(passo).slice(6, -1);
        const texto = resolver(t, textoVar);
        expect(contraste(texto, fundo), `${nome}: degrau ${passo} (${fundo} com ${texto})`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
  it("no escuro o WhatsApp deixou de ser quase branco", () => {
    expect(lum(resolver(escuro, "channel-whatsapp"))).toBeLessThan(0.4);
  });
});

describe("mapa de calor", () => {
  it("usa 7 degraus fixos e o mais próximo", () => {
    expect(HEAT_STEPS).toHaveLength(7);
    expect(heatStep(0)).toBe(0);
    expect(heatStep(1)).toBe(1);
    expect(heatStep(0.8)).toBe(0.85);
    expect(heatStep(Number.NaN)).toBe(0);
    expect(heatStep(-3)).toBe(0);
    expect(heatStep(9)).toBe(1);
  });
  it("devolve cor em tons de laranja a partir do tema", () => {
    expect(heatColor(1)).toBe("color-mix(in srgb, var(--heat-high) 100%, var(--heat-low))");
    expect(heatColor(0)).toBe("color-mix(in srgb, var(--heat-high) 0%, var(--heat-low))");
    expect(heatTextColor(1)).toBe("var(--heat-text-high)");
    expect(heatTextColor(0.3)).toBe("var(--foreground)");
  });
});

describe("evolução e degradê", () => {
  it("com menos de 3 pontos vale a barra; de 3 em diante, a área", () => {
    expect(trendChartKind(0)).toBe("barras");
    expect(trendChartKind(1)).toBe("barras");
    expect(trendChartKind(2)).toBe("barras");
    expect(trendChartKind(3)).toBe("area");
    expect(trendChartKind(31)).toBe("area");
  });
  it("o degradê vai da cor da série no topo até 0 embaixo, com a opacidade do tema", () => {
    const html = renderToStaticMarkup(
      <svg>
        <defs>
          <ChartAreaGradient id="g1" color="var(--chart-1)" />
        </defs>
      </svg>
    );
    expect(html).toContain('id="g1"');
    expect(html).toContain("stop-color:var(--chart-1)");
    expect(html).toContain("stop-opacity:var(--chart-area-top)");
    expect(html).toContain("stop-opacity:0");
    expect(claro["chart-area-top"]).toBeTruthy();
    expect(escuro["chart-area-top"]).toBeTruthy();
  });
});
