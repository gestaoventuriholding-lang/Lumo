import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { ACTIVE_PRESET, PRESETS, applyPreset, isPreset } from "./themePreset";

// O tema do Ellos mora em client/src/index.css. Estes testes protegem a paleta aprovada, o contraste AA e a regra
// "nenhuma cor solta no código".
const SRC = join(process.cwd(), "client", "src");
const css = readFileSync(join(SRC, "index.css"), "utf8").replace(/\r\n/g, "\n");

function bloco(seletor: string): Record<string, string> {
  const inicio = css.indexOf(`\n${seletor} {`);
  if (inicio < 0) throw new Error(`bloco ${seletor} não encontrado`);
  const fim = css.indexOf("\n}", inicio);
  const corpo = css.slice(inicio, fim);
  const out: Record<string, string> = {};
  for (const m of corpo.matchAll(/^\s*--([a-z0-9-]+):\s*([^;]+);/gm)) out[m[1]] = m[2].trim();
  return out;
}
const claro = bloco(":root");
const escuro = { ...claro, ...bloco(".dark") }; // o escuro herda o que não redefine (ex.: --primary: var(--brand))
const laranjaClaro = bloco('html[data-preset="laranja"]');
const laranjaEscuro = { ...laranjaClaro, ...bloco('html.dark[data-preset="laranja"]') };

function resolver(tema: Record<string, string>, nome: string, extra: Record<string, string> = {}): string {
  let v = { ...tema, ...extra }[nome];
  for (let i = 0; i < 6 && v?.startsWith("var("); i++) {
    const ref = v.slice(6, -1).split(",")[0];
    v = { ...tema, ...extra }[ref];
  }
  if (v === undefined) throw new Error(`variável --${nome} sem valor`);
  return v;
}

const rgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const lin = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (h: string) => {
  const [r, g, b] = rgb(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const misturar = (topo: [number, number, number], base: string, alfa: number) =>
  "#" +
  rgb(base)
    .map((c, i) => Math.round(topo[i] * alfa + c * (1 - alfa)).toString(16).padStart(2, "0"))
    .join("");
const rgbaDe = (s: string): { cor: [number, number, number]; alfa: number } => {
  const m = s.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
  if (!m) throw new Error(`rgba inválido: ${s}`);
  return { cor: [Number(m[1]), Number(m[2]), Number(m[3])], alfa: Number(m[4]) };
};

describe("tema: paleta aprovada (preset Check-Up)", () => {
  it("modo escuro: azul-marinho profundo, não preto", () => {
    const v = (n: string) => resolver(escuro, n).toLowerCase();
    expect(v("background")).toBe("#06101f");
    expect(v("card")).toBe("#0c1a30");
    expect(v("card-raised")).toBe("#122443");
    expect(v("popover")).toBe("#0f2038");
    expect(v("border")).toBe("#1d3256");
    expect(v("input")).toBe("#5f7dae");
    expect(v("foreground")).toBe("#eef4ff");
    expect(v("muted-foreground")).toBe("#a9b9d6");
    expect(v("brand")).toBe("#2f8bff");
    expect(v("brand-text")).toBe("#7db8ff");
    expect(v("primary")).toBe("#1f6fe0");
    expect(v("success")).toBe("#3fcf8e");
    expect(v("danger")).toBe("#f2555a");
    expect(v("warning")).toBe("#f5c518");
    expect(v("chart-grid")).toBe("#1d3256");
    expect(v("channel-ligacao")).toBe("#ff7a1a");
    expect(v("channel-whatsapp")).toBe("#8cd32f");
  });
  it("modo claro: fundo azulado, menu e botões em azul royal", () => {
    const v = (n: string) => resolver(claro, n).toLowerCase();
    expect(v("background")).toBe("#f3f6fb");
    expect(v("card")).toBe("#ffffff");
    expect(v("border")).toBe("#dce4ef");
    expect(v("foreground")).toBe("#0b1b33");
    expect(v("muted-foreground")).toBe("#4b5c78");
    expect(v("brand")).toBe("#0056b3");
    expect(v("primary")).toBe("#0056b3");
    expect(v("brand-text")).toBe("#0056b3");
    expect(v("success")).toBe("#15803d");
    expect(v("danger")).toBe("#c62828");
    expect(v("warning")).toBe("#8a5a00");
    expect(v("warning-fill")).toBe("#f5c518");
    expect(v("channel-ligacao")).toBe("#d65a00");
    expect(v("channel-whatsapp")).toBe("#4d7c0f");
  });
  it("a marca é azul nos dois modos e o fundo escuro é azul (não preto nem cinza)", () => {
    for (const t of [claro, escuro]) {
      const [r, g, b] = rgb(resolver(t, "brand"));
      expect(b).toBeGreaterThan(r + 60);
      expect(b).toBeGreaterThan(g);
    }
    const [r, g, b] = rgb(resolver(escuro, "background"));
    expect(b).toBeGreaterThan(r + 10); // azulado
    expect(Math.max(r, g, b)).toBeLessThan(0x30); // escuro
    expect(resolver(escuro, "background")).not.toBe("#000000");
  });
  it("o perigo é vermelho de verdade nos dois modos", () => {
    for (const t of [claro, escuro]) {
      const [r, g, b] = rgb(resolver(t, "danger"));
      expect(r).toBeGreaterThan(150);
      expect(g).toBeLessThan(90);
      expect(b).toBeLessThan(110);
    }
  });
  it("o brilho de fundo é discreto (até 6%) e em tom de azul", () => {
    for (const t of [claro, escuro]) {
      const { cor, alfa } = rgbaDe(resolver(t, "ambient-glow"));
      expect(alfa).toBeLessThanOrEqual(0.06);
      expect(cor[2]).toBeGreaterThan(cor[0] + 60);
    }
  });
  it("o modo escuro é o padrão do app", () => {
    const app = readFileSync(join(SRC, "App.tsx"), "utf8");
    expect(app).toContain('defaultTheme="dark"');
  });
});

describe("presets de tema", () => {
  it("o padrão é o Check-Up e o preset laranja está guardado no mesmo arquivo", () => {
    expect(ACTIVE_PRESET).toBe("checkup");
    expect([...PRESETS]).toEqual(["checkup", "laranja"]);
    expect(resolver(laranjaClaro, "brand").toLowerCase()).toBe("#ee6000");
    expect(resolver(laranjaEscuro, "brand").toLowerCase()).toBe("#ff6b00");
    expect(resolver(laranjaEscuro, "background").toLowerCase()).toBe("#000000");
    // no preset laranja a Ligação volta a ser azul (o canal acompanha o preset)
    expect(resolver(laranjaEscuro, "channel-ligacao").toLowerCase()).toBe("#4a90ff");
  });
  it("trocar de preset só liga ou desliga um atributo no html (nenhuma tela muda)", () => {
    const el = document.createElement("html");
    applyPreset("laranja", el);
    expect(el.getAttribute("data-preset")).toBe("laranja");
    applyPreset("checkup", el);
    expect(el.hasAttribute("data-preset")).toBe(false);
    expect(isPreset("laranja")).toBe(true);
    expect(isPreset("outro")).toBe(false);
  });
});

describe("tema: contraste AA (WCAG 2.1)", () => {
  const pares = (nome: string, t: Record<string, string>) => {
    const v = (n: string) => resolver(t, n);
    const texto: [string, string, string][] = [
      ["texto no cartão", v("foreground"), v("card")],
      ["texto no fundo", v("foreground"), v("background")],
      ["texto secundário no cartão", v("muted-foreground"), v("card")],
      ["texto secundário no fundo", v("muted-foreground"), v("background")],
      ["texto secundário no cartão elevado", v("muted-foreground"), v("card-raised")],
            ["verde no cartão", v("success"), v("card")],
      ["vermelho no cartão", v("danger"), v("card")],
      ["amarelo (texto) no cartão", v("warning"), v("card")],
      ["texto sobre o azul dos botões e do menu", v("primary-foreground"), v("primary")],
      ["azul em texto/link no cartão", v("brand-text"), v("card")],
    ];
    return { nome, texto, grafico: [["azul do gráfico", v("brand"), v("card")], ["WhatsApp", v("channel-whatsapp"), v("card")], ["borda de campo", v("input"), v("card")]] as [string, string, string][] };
  };
  for (const [nome, t] of [["claro", claro], ["escuro", escuro]] as const) {
    it(`texto com 4,5:1 no modo ${nome}`, () => {
      for (const [descricao, a, b] of pares(nome, t).texto) expect(contraste(a, b), `${nome}: ${descricao}`).toBeGreaterThanOrEqual(4.5);
    });
    it(`gráficos e bordas de campo com 3:1 no modo ${nome}`, () => {
      for (const [descricao, a, b] of pares(nome, t).grafico) expect(contraste(a, b), `${nome}: ${descricao}`).toBeGreaterThanOrEqual(3);
    });
  }
  it("texto sobre o vidro, no pior caso (vidro sobre o brilho laranja mais forte), passa em 4,5:1", () => {
    for (const [nome, t] of [["claro", claro], ["escuro", escuro]] as const) {
      const base = resolver(t, "background");
      const brilhoForte = misturar(rgb(resolver(t, "brand")), base, 0.22);
      const { cor, alfa } = rgbaDe(resolver(t, "glass-bg"));
      const vidro = misturar(cor, brilhoForte, alfa);
      expect(contraste(resolver(t, "foreground"), vidro), `${nome}: texto`).toBeGreaterThanOrEqual(4.5);
      expect(contraste(resolver(t, "muted-foreground"), vidro), `${nome}: texto secundário`).toBeGreaterThanOrEqual(4.5);
      const forte = rgbaDe(resolver(t, "glass-bg-strong"));
      expect(contraste(resolver(t, "foreground"), misturar(forte.cor, brilhoForte, forte.alfa)), `${nome}: janela`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("tema: vidro", () => {
  it("tem os estilos de vidro, o brilho laranja e a alternativa sólida no mesmo lugar das cores", () => {
    for (const nome of ["glass-bg", "glass-bg-strong", "glass-border", "glass-highlight", "glass-shadow", "glass-blur", "glass-solid", "ambient-glow"]) {
      expect(claro[nome], `claro --${nome}`).toBeTruthy();
    }
    expect(claro["glass-blur"]).toBe("14px");
    expect(css).toContain(".glass,");
    expect(css).toContain("@supports not ((backdrop-filter: blur(1px))");
    expect(css).toContain("prefers-reduced-transparency: reduce");
    expect(css).toContain("prefers-contrast: more");
    expect(css).toContain("body::before");
  });
  it("o desfoque só é definido no CSS central (nunca solto em componentes) e o desfoque do menu lateral é um só", () => {
    const achados: string[] = [];
    const andar = (dir: string) => {
      for (const nome of readdirSync(dir)) {
        const caminho = join(dir, nome);
        if (statSync(caminho).isDirectory()) andar(caminho);
        else if (/\.(tsx|ts)$/.test(nome) && !/\.test\./.test(nome) && /backdrop-blur|backdrop-filter/.test(readFileSync(caminho, "utf8"))) achados.push(relative(SRC, caminho));
      }
    };
    andar(join(SRC, "components"));
    andar(join(SRC, "pages"));
    // o fundo desfocado do overlay das janelas (ui/dialog etc.) conta como mais um desfoque: não deve existir
    expect(achados).toEqual([]);
    expect(css.match(/\[data-slot="sidebar-inner"\],/g)?.length ?? 0).toBeGreaterThan(0);
    expect(css).toMatch(/\.ellos-sidebar-shell \{[^}]*background-color: transparent/);
  });
  it("cartões do Dashboard seguem sólidos (sem vidro)", () => {
    const kpi = readFileSync(join(SRC, "components/DashboardKpiCard.tsx"), "utf8");
    expect(kpi).not.toMatch(/\bglass\b|backdrop/);
    const painel = css.match(/\.ellos-panel,\n  \.ellos-panel-sm \{[^}]*\}/)?.[0] ?? "";
    expect(painel).toContain("background-color: var(--card)");
  });
});

describe("tema: nenhuma cor solta no código", () => {
  // Estes dois arquivos entram na etapa 3 (tela Estruturas) e ainda têm cores próprias.
  const PERMITIDOS = new Set(["components/structure/StructureCanvas.tsx", "lib/structureAlign.ts", "lib/channelColors.ts"]);
  const sujos: string[] = [];
  const andar = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) andar(caminho);
      else if (/\.(tsx|ts)$/.test(nome) && !/\.test\./.test(nome)) {
        const rel = relative(SRC, caminho).replace(/\\/g, "/");
        if (PERMITIDOS.has(rel)) continue;
        const texto = readFileSync(caminho, "utf8");
        if (/#[0-9a-fA-F]{6}\b/.test(texto) || /\b(?:text|bg|border|ring|fill|stroke)-(?:red|green|blue|amber|yellow|orange|emerald|rose|sky|indigo|purple|pink|teal|cyan|lime|slate|gray|zinc|neutral|stone)-\d{2,3}\b/.test(texto)) sujos.push(rel);
      }
    }
  };
  it("componentes, telas e libs só usam as variáveis do tema", () => {
    andar(join(SRC, "components"));
    andar(join(SRC, "pages"));
    andar(join(SRC, "lib"));
    expect(sujos).toEqual([]);
  });
});
