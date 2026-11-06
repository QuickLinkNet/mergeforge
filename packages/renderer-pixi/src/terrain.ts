import { Container, Graphics } from "pixi.js";

import { deterministicOffset, polygonPoints } from "./geometry.js";
import { hexCorners } from "./hex.js";
import { fogColors, HEX_SIZE, terrainColors } from "./theme.js";

export function drawTileFace(
  target: Container,
  terrain: string,
  visible: boolean,
  q: number,
  r: number,
): void {
  const corners = polygonPoints(hexCorners({ x: 0, y: 0 }, HEX_SIZE));

  if (!visible) {
    const fog = new Graphics()
      .poly(corners)
      .fill({ color: fogColors.face, alpha: 0.98 })
      .stroke({ color: fogColors.edge, width: 1.3, alpha: 0.92 });
    const haze = new Graphics()
      .arc(-8, 2, 16, Math.PI * 0.85, Math.PI * 1.85)
      .stroke({ color: fogColors.hazeInner, width: 2, alpha: 0.22 })
      .arc(11, -7, 12, Math.PI * 0.1, Math.PI * 1.05)
      .stroke({ color: fogColors.hazeOuter, width: 1.4, alpha: 0.16 });
    target.addChild(fog, haze);
    return;
  }

  const colors = terrainColors[terrain] ?? terrainColors.grass;
  if (colors === undefined) {
    return;
  }

  const face = new Graphics()
    .poly(corners)
    .fill({ color: colors.face })
    .stroke({ color: colors.edge, width: 1.4, alpha: 0.86 });
  const highlight = new Graphics()
    .moveTo(-HEX_SIZE * 0.72, -HEX_SIZE * 0.48)
    .lineTo(0, -HEX_SIZE)
    .lineTo(HEX_SIZE * 0.72, -HEX_SIZE * 0.48)
    .stroke({ color: 0xffffff, width: 1.2, alpha: 0.12 });
  target.addChild(face, highlight);

  drawTerrainDecoration(target, terrain, q, r);
}

function drawTerrainDecoration(target: Container, terrain: string, q: number, r: number): void {
  const ox = (deterministicOffset(q, r, 1) - 0.5) * 18;
  const oy = (deterministicOffset(q, r, 2) - 0.5) * 13;

  if (terrain === "forest") {
    for (let index = 0; index < 3; index += 1) {
      const x = ox + (index - 1) * 13;
      const y = oy + Math.abs(index - 1) * 5;
      const tree = new Graphics()
        .rect(x - 1.8, y + 7, 3.6, 8)
        .fill({ color: 0x4c3526 })
        .poly([x, y - 14, x - 10, y + 7, x + 10, y + 7])
        .fill({ color: index === 1 ? 0x214f3b : 0x2b6143 })
        .poly([x, y - 6, x - 8, y + 11, x + 8, y + 11])
        .fill({ color: 0x356e48 });
      target.addChild(tree);
    }
    return;
  }

  if (terrain === "stone" || terrain === "mountain" || terrain === "hills") {
    const rock = new Graphics()
      .poly([ox - 15, oy + 11, ox - 7, oy - 12, ox + 3, oy - 2, ox + 11, oy - 15, ox + 17, oy + 11])
      .fill({ color: 0x596267 })
      .poly([ox - 7, oy - 12, ox + 3, oy - 2, ox - 1, oy + 11, ox - 15, oy + 11])
      .fill({ color: 0x727d80 })
      .poly([ox + 11, oy - 15, ox + 17, oy + 11, ox + 2, oy + 11])
      .fill({ color: 0x495359 });
    target.addChild(rock);
    return;
  }

  if (terrain === "water") {
    const waves = new Graphics();
    for (let index = -1; index <= 1; index += 1) {
      waves
        .moveTo(ox - 13, oy + index * 9)
        .bezierCurveTo(ox - 6, oy - 4 + index * 9, ox + 3, oy + 4 + index * 9, ox + 13, oy + index * 9)
        .stroke({ color: 0xa7d2d8, width: 1.5, alpha: 0.55 });
    }
    target.addChild(waves);
    return;
  }

  const grass = new Graphics()
    .moveTo(ox - 6, oy + 8)
    .lineTo(ox - 9, oy - 1)
    .moveTo(ox - 6, oy + 8)
    .lineTo(ox - 3, oy - 4)
    .moveTo(ox + 8, oy + 4)
    .lineTo(ox + 5, oy - 3)
    .moveTo(ox + 8, oy + 4)
    .lineTo(ox + 11, oy - 2)
    .stroke({ color: 0x365c38, width: 1.7, alpha: 0.62 });
  target.addChild(grass);
}
