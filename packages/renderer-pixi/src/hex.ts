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

/** Converts world-space pixels back to the nearest pointy-top axial hex. */
export function pixelToAxial(point: PixelPoint, size: number): AxialCoordinate {
  const q = ((SQRT_THREE / 3) * point.x - point.y / 3) / size;
  const r = ((2 / 3) * point.y) / size;
  return roundAxial(q, r);
}

function roundAxial(q: number, r: number): AxialCoordinate {
  const x = q;
  const z = r;
  const y = -x - z;
  let roundedX = Math.round(x);
  let roundedY = Math.round(y);
  let roundedZ = Math.round(z);
  const xDifference = Math.abs(roundedX - x);
  const yDifference = Math.abs(roundedY - y);
  const zDifference = Math.abs(roundedZ - z);

  if (xDifference > yDifference && xDifference > zDifference) {
    roundedX = -roundedY - roundedZ;
  } else if (yDifference > zDifference) {
    roundedY = -roundedX - roundedZ;
  } else {
    roundedZ = -roundedX - roundedY;
  }

  return {
    q: Object.is(roundedX, -0) ? 0 : roundedX,
    r: Object.is(roundedZ, -0) ? 0 : roundedZ,
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
