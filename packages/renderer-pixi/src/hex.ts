export interface AxialCoordinate {
  readonly q: number;
  readonly r: number;
}

export interface PixelPoint {
  readonly x: number;
  readonly y: number;
}

const SQRT_THREE = Math.sqrt(3);

/** Projects a pointy-top axial coordinate into world-space pixels. */
export function axialToPixel(coord: AxialCoordinate, size: number): PixelPoint {
  return {
    x: size * SQRT_THREE * (coord.q + coord.r / 2),
    y: size * 1.5 * coord.r,
  };
}

/** Returns clockwise pointy-top hex corners around a center. */
export function hexCorners(center: PixelPoint, size: number): readonly PixelPoint[] {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = ((60 * index - 30) * Math.PI) / 180;
    return {
      x: center.x + size * Math.cos(angle),
      y: center.y + size * Math.sin(angle),
    };
  });
}

export function axialKey(coord: AxialCoordinate): string {
  return `${coord.q},${coord.r}`;
}
