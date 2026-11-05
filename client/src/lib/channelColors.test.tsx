import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CARD_BACKGROUND,
  CHANNEL_PALETTE,
  DEFAULT_CHANNEL_COLORS,
  applyChannelColors,
  contrastRatio,
  isColorAvailable,
  mixOver,
  resolveChannelColor,
  sanitizeChoice,
  type ColorMode,
} from "./channelColors";

const css = readFileSync(join(process.cwd(), "client", "src", "index.css"), "utf8").replace(/\r\n/g, "\n");
const bloco = (inicio: string) => css.slice(css.indexOf(inicio), css.indexOf("\n}", css.indexOf(inicio)));
const valor = (b: string, nome: string) => new RegExp(`^  --${nome}: ([^;]+);`, "m").exec(b)?.[1].trim();
const modos: ColorMode[] = ["light", "dark"];

describe("cores dos canais: paleta", () => {
  it("tem cores principais e cores fortes e vibrantes, com ids únicos", () => {
    const ids = CHANNEL_PALETTE.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CHANNEL_PALETTE.filter((c) => c.group === "principais").length).toBeGreaterThanOrEqual(6);
    expect(CHANNEL_PALETTE.filter((c) => c.group === "vibrantes").length).toBeGreaterThanOrEqual(5);
  });

  it("o fundo do cartão usado no cálculo é o do tema (index.css) nos dois modos", () => {
    expect(valor(bloco(":root {"), "card")).toBe(CARD_BACKGROUND.light);
    expect(valor(bloco(".dark {"), "card")).toBe(CARD_BACKGROUND.dark);
  });

  it("as cores padrão têm exatamente os valores do tema", () => {
    for (const [modo, b] of [["light", bloco(":root {")], ["dark", bloco(".dark {")]] as const) {
      const lig = resolveChannelColor(CHANNEL_PALETTE.find((c) => c.id === DEFAULT_CHANNEL_COLORS.ligacao)!, modo);
      const wpp = resolveChannelColor(CHANNEL_PALETTE.find((c) => c.id === DEFAULT_CHANNEL_COLORS.whatsapp)!, modo);
      expect(lig.base).toBe(valor(b, "channel-ligacao"));
      expect(lig.text).toBe(valor(b, "channel-ligacao-text"));
      expect(wpp.base).toBe(valor(b, "channel-whatsapp"));
      expect(wpp.text).toBe(valor(b, "channel-whatsapp-text"));
    }
  });

  for (const modo of modos) {
    it(`toda cor passa nos contrastes mínimos no modo ${modo}: traço ≥ 3:1 e texto ≥ 4,5:1 (cartão e fundo do selo)`, () => {
      const falhas: string[] = [];
      for (const c of CHANNEL_PALETTE) {
        const v = resolveChannelColor(c, modo);
        const alfa = Number(/, ([\d.]+)\)$/.exec(v.soft)![1]);
        const selo = mixOver(v.base, CARD_BACKGROUND[modo], alfa);
        if (contrastRatio(v.base, CARD_BACKGROUND[modo]) < 3) falhas.push(`${c.id} traço`);
        if (contrastRatio(v.text, CARD_BACKGROUND[modo]) < 4.5) falhas.push(`${c.id} texto/cartão`);
        if (contrastRatio(v.text, selo) < 4.5) falhas.push(`${c.id} texto/selo`);
      }
      expect(falhas).toEqual([]);
    });
  }

  it("no modo escuro as cores vibrantes aparecem como escolhidas (não são escurecidas)", () => {
    for (const c of CHANNEL_PALETTE.filter((x) => x.group === "vibrantes")) {
      expect(resolveChannelColor(c, "dark").base.toLowerCase()).toBe(c.hex.toLowerCase());
    }
  });
});

describe("cores dos canais: escolha", () => {
  it("escolha inválida, desconhecida ou com duas cores da mesma família volta ao padrão", () => {
    expect(sanitizeChoice(null)).toEqual(DEFAULT_CHANNEL_COLORS);
    expect(sanitizeChoice({ ligacao: "azul", whatsapp: "nao-existe" })).toEqual(DEFAULT_CHANNEL_COLORS);
    expect(sanitizeChoice({ ligacao: "laranja", whatsapp: "laranja-vibrante" })).toEqual(DEFAULT_CHANNEL_COLORS);
    expect(sanitizeChoice({ ligacao: "azul-eletrico", whatsapp: "verde-vibrante" })).toEqual({ ligacao: "azul-eletrico", whatsapp: "verde-vibrante" });
  });

  it("a cor (ou uma parecida) do outro canal fica indisponível", () => {
    const atual = { ligacao: "laranja", whatsapp: "verde-limao" };
    expect(isColorAvailable("laranja-vibrante", "whatsapp", atual)).toBe(false);
    expect(isColorAvailable("azul", "whatsapp", atual)).toBe(true);
    expect(isColorAvailable("verde-vibrante", "ligacao", atual)).toBe(false);
    expect(isColorAvailable("verde-vibrante", "whatsapp", atual)).toBe(true);
  });
});

describe("cores dos canais: aplicação no <html>", () => {
  it("define as variáveis do canal no modo atual e as remove sem escolha", () => {
    const el = document.createElement("html");
    applyChannelColors({ ligacao: "azul-eletrico", whatsapp: "magenta" }, "dark", el);
    expect(el.style.getPropertyValue("--channel-ligacao").toLowerCase()).toBe("#0a7cff");
    expect(el.style.getPropertyValue("--channel-whatsapp-text")).not.toBe("");
    expect(el.style.getPropertyValue("--channel-whatsapp-soft")).toMatch(/^rgba\(/);
    applyChannelColors({ ligacao: "ciano", whatsapp: "magenta" }, "dark", el);
    expect(el.style.getPropertyValue("--channel-ligacao").toLowerCase()).toBe("#00cfe8");
    applyChannelColors({ ligacao: "ciano", whatsapp: "magenta" }, "light", el);
    expect(el.style.getPropertyValue("--channel-ligacao").toLowerCase()).not.toBe("#00cfe8"); // escurece no claro
    applyChannelColors(null, "dark", el);
    expect(el.style.getPropertyValue("--channel-ligacao")).toBe("");
    expect(el.style.getPropertyValue("--channel-whatsapp-soft")).toBe("");
  });
});
