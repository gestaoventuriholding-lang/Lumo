import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { applyOnOrange, readOnOrangeFromSearch, resolveOnOrange } from "./onOrange";

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
const opcaoB = bloco('html[data-on-orange="b"]');

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

describe("tema: paleta aprovada", () => {
  it("modo escuro", () => {
    const v = (n: string) => resolver(escuro, n).toLowerCase();
    expect(v("background")).toBe("#0f0d0c");
    expect(v("card")).toBe("#171412");
    expect(v("card-raised")).toBe("#1f1b18");
    expect(v("popover")).toBe("#1b1815");
    expect(v("border")).toBe("#2b2521");
    expect(v("input")).toBe("#756c63");
    expect(v("foreground")).toBe("#f5f0eb");
    expect(v("muted-foreground")).toBe("#aba29a");
    expect(v("brand")).toBe("#ff6b00");
    expect(v("brand-text")).toBe("#ff8a3d");
    expect(v("success")).toBe("#3fcf8e");
    expect(v("danger")).toBe("#f2555a");
    expect(v("warning")).toBe("#f5c518");
    expect(v("channel-whatsapp")).toBe("#8e857c");
    expect(v("chart-grid")).toBe("#2b2521");
  });
  it("modo claro", () => {
    const v = (n: string) => resolver(claro, n).toLowerCase();
    expect(v("background")).toBe("#f7f4f0");
    expect(v("card")).toBe("#ffffff");
    expect(v("border")).toBe("#e5ded7");
    expect(v("foreground")).toBe("#1c1815");
    expect(v("muted-foreground")).toBe("#62594f");
    expect(v("brand")).toBe("#ee6000");
    expect(v("brand-text")).toBe("#b83f00");
    expect(v("success")).toBe("#15803d");
    expect(v("danger")).toBe("#c62828");
    expect(v("warning")).toBe("#8a5a00");
    expect(v("warning-fill")).toBe("#f5c518");
    expect(v("channel-whatsapp")).toBe("#6f665d");
  });
  it("o perigo não é mais um laranja: vermelho de verdade nos dois modos, e o WhatsApp não é quase branco", () => {
    for (const t of [claro, escuro]) {
      const [r, g, b] = rgb(resolver(t, "danger"));
      expect(r).toBeGreaterThan(150);
      expect(g).toBeLessThan(90);
      expect(b).toBeLessThan(110);
    }
    expect(lum(resolver(escuro, "channel-whatsapp"))).toBeLessThan(0.3); // antes era #f2f1ef (≈0,88)
  });
  it("o modo escuro é o padrão do app", () => {
    const app = readFileSync(join(SRC, "App.tsx"), "utf8");
    expect(app).toContain('defaultTheme="dark"');
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
      ["laranja em texto no cartão", v("brand-text"), v("card")],
      ["verde no cartão", v("success"), v("card")],
      ["vermelho no cartão", v("danger"), v("card")],
      ["amarelo (texto) no cartão", v("warning"), v("card")],
      ["texto sobre o laranja (opção A)", v("primary-foreground"), v("primary")],
    ];
    return { nome, texto, grafico: [["laranja do gráfico", v("brand"), v("card")], ["WhatsApp", v("channel-whatsapp"), v("card")], ["borda de campo", v("input"), v("card")]] as [string, string, string][] };
  };
  for (const [nome, t] of [["claro", claro], ["escuro", escuro]] as const) {
    it(`texto com 4,5:1 no modo ${nome}`, () => {
      for (const [descricao, a, b] of pares(nome, t).texto) expect(contraste(a, b), `${nome}: ${descricao}`).toBeGreaterThanOrEqual(4.5);
    });
    it(`gráficos e bordas de campo com 3:1 no modo ${nome}`, () => {
      for (const [descricao, a, b] of pares(nome, t).grafico) expect(contraste(a, b), `${nome}: ${descricao}`).toBeGreaterThanOrEqual(3);
    });
  }
  it("opção B: texto branco sobre o laranja fechado passa em 4,5:1", () => {
    expect(contraste(resolver(escuro, "primary", opcaoB), "#000000")).toBeGreaterThan(0); // o override existe
    expect(contraste(opcaoB["primary-foreground"], opcaoB.primary)).toBeGreaterThanOrEqual(4.5);
  });
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
  const PERMITIDOS = new Set(["components/structure/StructureCanvas.tsx", "lib/structureAlign.ts", "lib/chartTheme.ts", "lib/escalloDemo.ts"]);
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

describe("comparação do texto sobre o laranja (A × B)", () => {
  it("lê A ou B do endereço e ignora o resto", () => {
    expect(readOnOrangeFromSearch("?laranja=b")).toBe("b");
    expect(readOnOrangeFromSearch("?laranja=A")).toBe("a");
    expect(readOnOrangeFromSearch("?laranja=c")).toBeNull();
    expect(readOnOrangeFromSearch("")).toBeNull();
  });
  it("o endereço vence o que ficou guardado, e sem nada vale A", () => {
    expect(resolveOnOrange("?laranja=b", "a")).toBe("b");
    expect(resolveOnOrange("", "b")).toBe("b");
    expect(resolveOnOrange("", null)).toBe("a");
    expect(resolveOnOrange("", "lixo")).toBe("a");
  });
  it("B liga o atributo no html e A tira", () => {
    const el = document.createElement("html");
    applyOnOrange("b", el);
    expect(el.getAttribute("data-on-orange")).toBe("b");
    applyOnOrange("a", el);
    expect(el.hasAttribute("data-on-orange")).toBe(false);
  });
  it("o alternador só existe em pré-visualização: no oficial nada é aplicado", async () => {
    const { default: Switch } = await import("../components/OnOrangeSwitch");
    const { renderToString } = await import("react-dom/server");
    // jsdom roda em localhost (permitido): aparece. O teste de bloqueio do oficial fica em demoPermitida (escalloVinculos.test).
    expect(renderToString(<Switch />)).toContain("A · texto escuro");
    const { demoPermitida } = await import("./escalloDemo");
    expect(demoPermitida("ellos.venturiholding.com.br")).toBe(false);
  });
});
