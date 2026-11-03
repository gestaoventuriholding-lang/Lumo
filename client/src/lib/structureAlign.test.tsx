import { describe, expect, it } from "vitest";
import { alignElements, distributeElements, elementsInRect } from "./structureAlign";

const box = (id: string, x: number, y: number, width = 40, height = 20) => ({ id, x, y, width, height });

describe("alinhamento da estrutura", () => {
  const items = [box("a", 10, 10), box("b", 100, 50, 60, 30), box("c", 300, 90)];

  it("alinha à esquerda, à direita e ao centro", () => {
    expect(alignElements(items, "left").map((p) => p.patch.x)).toEqual([10, 10, 10]);
    expect(alignElements(items, "right").map((p) => p.patch.x)).toEqual([300, 280, 300]);
    expect(alignElements(items, "center").map((p) => p.patch.x)).toEqual([155, 145, 155]);
  });

  it("alinha ao topo, ao meio e à base", () => {
    expect(alignElements(items, "top").map((p) => p.patch.y)).toEqual([10, 10, 10]);
    expect(alignElements(items, "bottom").map((p) => p.patch.y)).toEqual([90, 80, 90]);
    expect(alignElements(items, "middle").map((p) => p.patch.y)).toEqual([50, 45, 50]);
  });

  it("não faz nada com menos de 2 elementos", () => {
    expect(alignElements([items[0]], "left")).toEqual([]);
  });

  it("distribui com espaços iguais mantendo as pontas", () => {
    const patches = distributeElements([box("a", 0, 0), box("b", 50, 0), box("c", 300, 0)], "horizontal");
    expect(patches).toEqual([
      { id: "a", patch: { x: 0, y: 0 } },
      { id: "b", patch: { x: 150, y: 0 } },
      { id: "c", patch: { x: 300, y: 0 } },
    ]);
    expect(distributeElements(items.slice(0, 2), "vertical")).toEqual([]);
  });

  it("seleciona o que toca a área desenhada", () => {
    expect(elementsInRect(items, { x1: 0, y1: 0, x2: 120, y2: 60 })).toEqual(["a", "b"]);
    expect(elementsInRect(items, { x1: 500, y1: 500, x2: 400, y2: 400 })).toEqual([]);
  });
});
