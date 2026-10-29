import { describe, expect, it } from "vitest";
import { createStructureElement } from "./structureFactory";
import { applyResizeDelta, clampElementBounds, clampMovePosition } from "./structureElementBounds";

describe("structureElementBounds", () => {
  it("keeps element inside canvas when moving", () => {
    const element = createStructureElement("desk-single", { x: 100, y: 100 });
    const next = clampMovePosition(element, 2000, 2000);
    expect(next.x).toBeLessThan(2000);
    expect(next.y).toBeLessThan(2000);
  });

  it("resizes from south-east handle", () => {
    const element = createStructureElement("area", { x: 40, y: 40 });
    const bounds = applyResizeDelta(element, "se", 40, 30, {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    });
    expect(bounds.width).toBe(element.width + 40);
    expect(bounds.height).toBe(element.height + 30);
    expect(bounds.x).toBe(element.x);
    expect(bounds.y).toBe(element.y);
  });

  it("respects minimum size for walls", () => {
    const element = createStructureElement("wall", { x: 40, y: 40 });
    const bounds = clampElementBounds(element, { width: 10, height: 2 });
    expect(bounds.width).toBeGreaterThanOrEqual(20);
    expect(bounds.height).toBeGreaterThanOrEqual(6);
  });
});
