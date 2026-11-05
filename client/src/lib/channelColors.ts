/**
 * Cores dos canais (Ligação e WhatsApp) escolhidas por cada pessoa em Configurações → Aparência.
 *
 * A escolha vale só neste navegador (como o tema) e é aplicada como variáveis CSS no <html>: --channel-ligacao,
 * --channel-ligacao-text, --channel-ligacao-soft (e as do WhatsApp). Sem escolha, valem as cores do tema em index.css.
 *
 * Este arquivo é a única exceção à regra "nenhuma cor solta no código": a paleta para escolher É dado de cor.
 * Para a escolha nunca ficar ilegível, cada cor passa por um ajuste de contraste nos dois modos:
 *   - traço/barra/fatia (--channel-*)          ≥ 3:1 contra o cartão
 *   - texto do canal (--channel-*-text)        ≥ 4,5:1 contra o cartão e contra o fundo suave do selo
 * Então uma cor "vibrante" pode ficar um pouco mais escura no modo claro; no escuro ela aparece como escolhida.
 */

export type ChannelKey = "ligacao" | "whatsapp";
export type ColorMode = "light" | "dark";
export type PaletteGroup = "principais" | "vibrantes";

export interface ChannelPaletteColor {
  id: string;
  label: string;
  group: PaletteGroup;
  /** Cores parecidas (ex.: laranja e laranja vibrante) são da mesma família e não podem ser os dois canais ao mesmo tempo */
  family: string;
  /** Cor pura da amostra e ponto de partida do ajuste de contraste */
  hex: string;
  /** Valores fixos por modo (só as cores padrão do tema, para ficarem idênticas às de index.css) */
  fixed?: Record<ColorMode, { base: string; text: string }>;
}

export const CHANNEL_PALETTE: readonly ChannelPaletteColor[] = [
  // ---- principais ----
  {
    id: "laranja", label: "Laranja", group: "principais", family: "laranja", hex: "#E8630A",
    fixed: { light: { base: "#d65a00", text: "#a84700" }, dark: { base: "#ff7a1a", text: "#ff9a4d" } },
  },
  {
    id: "verde-limao", label: "Verde-limão", group: "principais", family: "verde", hex: "#6FA81B",
    fixed: { light: { base: "#4d7c0f", text: "#3f6a0a" }, dark: { base: "#8cd32f", text: "#a8e25a" } },
  },
  { id: "azul", label: "Azul", group: "principais", family: "azul", hex: "#2F6FE0" },
  { id: "roxo", label: "Roxo", group: "principais", family: "roxo", hex: "#7A5AD6" },
  { id: "rosa", label: "Rosa", group: "principais", family: "rosa", hex: "#D6457F" },
  { id: "turquesa", label: "Turquesa", group: "principais", family: "turquesa", hex: "#12A3A3" },
  { id: "cinza", label: "Cinza quente", group: "principais", family: "cinza", hex: "#8E857C" },
  // ---- fortes e vibrantes ----
  { id: "laranja-vibrante", label: "Laranja vibrante", group: "vibrantes", family: "laranja", hex: "#FF6A00" },
  { id: "verde-vibrante", label: "Verde vibrante", group: "vibrantes", family: "verde", hex: "#39E01F" },
  { id: "azul-eletrico", label: "Azul elétrico", group: "vibrantes", family: "azul", hex: "#0A7CFF" },
  { id: "violeta", label: "Violeta", group: "vibrantes", family: "roxo", hex: "#8B3DFF" },
  { id: "magenta", label: "Magenta", group: "vibrantes", family: "rosa", hex: "#FF2D95" },
  { id: "ciano", label: "Ciano", group: "vibrantes", family: "turquesa", hex: "#00CFE8" },
];

export const DEFAULT_CHANNEL_COLORS: Record<ChannelKey, string> = { ligacao: "laranja", whatsapp: "verde-limao" };

/** Fundos dos cartões (iguais a --card em index.css; um teste confere) */
export const CARD_BACKGROUND: Record<ColorMode, string> = { light: "#ffffff", dark: "#0c1a30" };
/** Opacidade do fundo suave do selo (igual a --channel-*-soft em index.css) */
const SOFT_ALPHA: Record<ColorMode, number> = { light: 0.12, dark: 0.16 };

// ---------------------------------------------------------------- matemática de cor
type RGB = [number, number, number];
const toRgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
const toHex = ([r, g, b]: RGB) =>
  "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const lin = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = (hex: string) => {
  const [r, g, b] = toRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** Mistura `topo` sobre `base` com opacidade `alfa` */
export function mixOver(topo: string, base: string, alfa: number): string {
  const [t, b] = [toRgb(topo), toRgb(base)];
  return toHex(t.map((v, i) => v * alfa + b[i] * (1 - alfa)) as RGB);
}

function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = toRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function fromHsl(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

/** Escurece (modo claro) ou clareia (modo escuro) a cor, em passos pequenos, até `ok(cor)` ser verdadeiro */
function ajustar(hex: string, mode: ColorMode, ok: (cor: string) => boolean): string {
  if (ok(hex)) return hex;
  const [h, s, l0] = toHsl(hex);
  const passo = mode === "light" ? -0.01 : 0.01;
  let l = l0;
  let cor = hex;
  for (let i = 0; i < 100 && !ok(cor); i++) {
    l = Math.max(0, Math.min(1, l + passo));
    cor = fromHsl(h, s, l);
  }
  return cor;
}

export interface ChannelColorValues {
  base: string;
  text: string;
  /** rgba() do fundo suave do selo */
  soft: string;
}

export function resolveChannelColor(color: ChannelPaletteColor, mode: ColorMode): ChannelColorValues {
  const card = CARD_BACKGROUND[mode];
  const alfa = SOFT_ALPHA[mode];
  const fixed = color.fixed?.[mode];
  const base = fixed?.base ?? ajustar(color.hex, mode, (c) => contrastRatio(c, card) >= 3);
  const [r, g, b] = toRgb(base);
  const soft = `rgba(${r}, ${g}, ${b}, ${alfa})`;
  const fundoDoSelo = mixOver(base, card, alfa);
  const text =
    fixed?.text ?? ajustar(base, mode, (c) => contrastRatio(c, card) >= 4.5 && contrastRatio(c, fundoDoSelo) >= 4.5);
  return { base, text, soft };
}

// ---------------------------------------------------------------- escolha, validação e armazenamento
export type ChannelColorChoice = Record<ChannelKey, string>;

const STORAGE_KEY = "ellos-channel-colors";
const porId = (id: string) => CHANNEL_PALETTE.find((c) => c.id === id);

/** Escolha válida: ids que existem e de famílias diferentes. Qualquer outra coisa volta ao padrão. */
export function sanitizeChoice(valor: unknown): ChannelColorChoice {
  const v = (valor ?? {}) as Partial<Record<ChannelKey, unknown>>;
  const lig = typeof v.ligacao === "string" ? porId(v.ligacao) : undefined;
  const wpp = typeof v.whatsapp === "string" ? porId(v.whatsapp) : undefined;
  if (!lig || !wpp || lig.family === wpp.family) return { ...DEFAULT_CHANNEL_COLORS };
  return { ligacao: lig.id, whatsapp: wpp.id };
}

/** Uma cor só pode ser escolhida para um canal se a família dela não for a do outro canal */
export function isColorAvailable(colorId: string, channel: ChannelKey, choice: ChannelColorChoice): boolean {
  const outro = porId(choice[channel === "ligacao" ? "whatsapp" : "ligacao"]);
  return !outro || porId(colorId)?.family !== outro.family;
}

export function loadChannelColors(): ChannelColorChoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeChoice(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Grava a escolha; `null` apaga e volta às cores do tema */
export function saveChannelColors(choice: ChannelColorChoice | null): void {
  try {
    if (choice) localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* sem armazenamento (janela privada): vale só até fechar a página */
  }
  listeners.forEach((l) => l());
}

const listeners = new Set<() => void>();
export function subscribeChannelColors(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

const CANAL_CSS: Record<ChannelKey, string> = { ligacao: "channel-ligacao", whatsapp: "channel-whatsapp" };

/** Aplica a escolha no <html> para o modo atual; sem escolha, remove as variáveis e valem as do tema */
export function applyChannelColors(
  choice: ChannelColorChoice | null,
  mode: ColorMode,
  root: HTMLElement = document.documentElement
): void {
  for (const canal of Object.keys(CANAL_CSS) as ChannelKey[]) {
    const nome = CANAL_CSS[canal];
    const cor = choice ? porId(choice[canal]) : undefined;
    if (!cor) {
      for (const sufixo of ["", "-text", "-soft"]) root.style.removeProperty(`--${nome}${sufixo}`);
      continue;
    }
    const v = resolveChannelColor(cor, mode);
    root.style.setProperty(`--${nome}`, v.base);
    root.style.setProperty(`--${nome}-text`, v.text);
    root.style.setProperty(`--${nome}-soft`, v.soft);
  }
}
