import type { StructureElement } from "@/types/structure";

export type AlignMode = "left" | "center" | "right" | "top" | "middle" | "bottom";
export type DistributeAxis = "horizontal" | "vertical";

export type ElementPatch = { id: string; patch: Pick<StructureElement, "x" | "y"> };

type Box = Pick<StructureElement, "id" | "x" | "y" | "width" | "height">;

/** Alinha os elementos às bordas (ou ao centro) do retângulo que envolve a seleção */
export function alignElements(elements: Box[], mode: AlignMode): ElementPatch[] {
  if (elements.length < 2) return [];
  const left = Math.min(...elements.map((el) => el.x));
  const right = Math.max(...elements.map((el) => el.x + el.width));
  const top = Math.min(...elements.map((el) => el.y));
  const bottom = Math.max(...elements.map((el) => el.y + el.height));

  return elements.map((el) => {
    let x = el.x;
    let y = el.y;
    if (mode === "left") x = left;
    if (mode === "right") x = right - el.width;
    if (mode === "center") x = (left + right) / 2 - el.width / 2;
    if (mode === "top") y = top;
    if (mode === "bottom") y = bottom - el.height;
    if (mode === "middle") y = (top + bottom) / 2 - el.height / 2;
    return { id: el.id, patch: { x: Math.round(x), y: Math.round(y) } };
  });
}

/** Deixa o mesmo espaço entre os elementos; o primeiro e o último ficam onde estão */
export function distributeElements(elements: Box[], axis: DistributeAxis): ElementPatch[] {
  if (elements.length < 3) return [];
  const horizontal = axis === "horizontal";
  const start = (el: Box) => (horizontal ? el.x : el.y);
  const size = (el: Box) => (horizontal ? el.width : el.height);

  const sorted = [...elements].sort((a, b) => start(a) - start(b));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = start(last) + size(last) - start(first);
  const used = sorted.reduce((sum, el) => sum + size(el), 0);
  const gap = (span - used) / (sorted.length - 1);

  let cursor = start(first);
  return sorted.map((el) => {
    const position = Math.round(cursor);
    cursor += size(el) + gap;
    return {
      id: el.id,
      patch: horizontal ? { x: position, y: el.y } : { x: el.x, y: position },
    };
  });
}

/** Elementos cujo retângulo toca a área desenhada com o mouse */
export function elementsInRect(
  elements: Box[],
  rect: { x1: number; y1: number; x2: number; y2: number }
): string[] {
  const left = Math.min(rect.x1, rect.x2);
  const right = Math.max(rect.x1, rect.x2);
  const top = Math.min(rect.y1, rect.y2);
  const bottom = Math.max(rect.y1, rect.y2);
  return elements
    .filter(
      (el) => el.x < right && el.x + el.width > left && el.y < bottom && el.y + el.height > top
    )
    .map((el) => el.id);
}

/** Cores oferecidas no editor (nome para dica + valor) */
export const STRUCTURE_COLORS = [
  { name: "Azul", value: "#3366FF" },
  { name: "Azul claro", value: "#7BA7FF" },
  { name: "Verde", value: "#16A34A" },
  { name: "Amarelo", value: "#EAB308" },
  { name: "Laranja", value: "#F97316" },
  { name: "Vermelho", value: "#DC2626" },
  { name: "Roxo", value: "#8B5CF6" },
  { name: "Rosa", value: "#EC4899" },
  { name: "Cinza", value: "#64748B" },
] as const;
