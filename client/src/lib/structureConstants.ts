export const STRUCTURE_CANVAS_WIDTH = 1120;
export const STRUCTURE_CANVAS_HEIGHT = 720;

/** Tamanho de cada quadrado da grade (px do layout) */
export const STRUCTURE_GRID_SIZE = 20;

export function snapToGrid(value: number): number {
  return Math.round(value / STRUCTURE_GRID_SIZE) * STRUCTURE_GRID_SIZE;
}

export function getCenteredPosition(
  width: number,
  height: number,
  index = 0
): { x: number; y: number } {
  const ring = index % 8;
  const ringOffset = Math.floor(index / 8) * 36;
  const angles = [
    { dx: 0, dy: 0 },
    { dx: 32, dy: 0 },
    { dx: 32, dy: 32 },
    { dx: 0, dy: 32 },
    { dx: -32, dy: 32 },
    { dx: -32, dy: 0 },
    { dx: -32, dy: -32 },
    { dx: 0, dy: -32 },
  ];
  const { dx, dy } = angles[ring] ?? { dx: 0, dy: 0 };

  const x = (STRUCTURE_CANVAS_WIDTH - width) / 2 + dx + ringOffset;
  const y = (STRUCTURE_CANVAS_HEIGHT - height) / 2 + dy + ringOffset;

  return {
    x: Math.max(16, Math.min(snapToGrid(x), STRUCTURE_CANVAS_WIDTH - width - 16)),
    y: Math.max(16, Math.min(snapToGrid(y), STRUCTURE_CANVAS_HEIGHT - height - 16)),
  };
}
