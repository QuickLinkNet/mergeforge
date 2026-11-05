/**
 * Renders the build catalog as one SVG picture: the tech tree with cost, build
 * time and prerequisites. Deterministic (same catalog, same bytes), so a test can
 * keep docs/TECH_TREE.svg in step with the game: `npm run techtree` rewrites it.
 */

import {
  buildPulses,
  catalogDepths,
  formatBuildTime,
  type CatalogCategory,
  type CatalogEntry,
} from "./catalog";

const NODE_WIDTH = 270;
const COLUMN_GAP = 96;
const ROW_GAP = 22;
const MARGIN = 36;
const HEADER = 96;
const FOOTER = 78;
const PADDING = 12;
const CHARS_PER_LINE = 38;

const CATEGORY_STYLE: Readonly<Record<CatalogCategory, { color: string; label: string }>> = {
  infrastructure: { color: "#9a8f7a", label: "Infrastruktur" },
  production: { color: "#c98a3b", label: "Produktion" },
  unit: { color: "#4f9d6b", label: "Einheit" },
  research: { color: "#5b86c9", label: "Forschung" },
  network: { color: "#9b6bc9", label: "Signalnetz" },
  module: { color: "#d0587a", label: "Modul (Daten-PR)" },
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(text: string, limit = CHARS_PER_LINE): readonly string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line !== "" && `${line} ${word}`.length > limit) {
      lines.push(line);
      line = word;
    } else {
      line = line === "" ? word : `${line} ${word}`;
    }
  }
  if (line !== "") lines.push(line);
  return lines;
}

interface Placed {
  readonly entry: CatalogEntry;
  readonly x: number;
  readonly y: number;
  readonly height: number;
  readonly effectLines: readonly string[];
  readonly conditionLines: readonly string[];
}

export function renderTechTreeSvg(entries: readonly CatalogEntry[]): string {
  const depths = catalogDepths(entries);
  const columns = Math.max(...entries.map((entry) => depths.get(entry.id) ?? 0)) + 1;

  const placed = new Map<string, Placed>();
  const columnBottoms = new Array<number>(columns).fill(HEADER);
  for (const entry of entries) {
    const column = depths.get(entry.id) ?? 0;
    const effectLines = wrap(entry.effect);
    const conditionLines = wrap(`Voraussetzung: ${entry.condition}`);
    const height = 20 + 20 + 18 + 18 + effectLines.length * 15 + 6 + conditionLines.length * 14 + PADDING;
    const y = columnBottoms[column] ?? HEADER;
    columnBottoms[column] = y + height + ROW_GAP;
    placed.set(entry.id, {
      entry,
      x: MARGIN + column * (NODE_WIDTH + COLUMN_GAP),
      y,
      height,
      effectLines,
      conditionLines,
    });
  }

  const width = MARGIN * 2 + columns * NODE_WIDTH + (columns - 1) * COLUMN_GAP;
  const contentBottom = Math.max(...columnBottoms) - ROW_GAP;
  const height = contentBottom + FOOTER;

  const edges: string[] = [];
  for (const target of placed.values()) {
    for (const requiredId of target.entry.requires) {
      const source = placed.get(requiredId);
      if (source === undefined) continue;
      const x1 = source.x + NODE_WIDTH;
      const y1 = source.y + source.height / 2;
      const x2 = target.x;
      const y2 = target.y + target.height / 2;
      const bend = (x2 - x1) / 2;
      edges.push(
        `<path d="M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}" fill="none" stroke="#7d8aa3" stroke-width="2" marker-end="url(#arrow)"/>`,
      );
    }
  }

  const nodes: string[] = [];
  for (const node of placed.values()) {
    const { entry } = node;
    const style = CATEGORY_STYLE[entry.category];
    const cost =
      entry.cost.wood === 0 && entry.cost.stone === 0
        ? "kostenlos"
        : [
            entry.cost.wood > 0 ? `${entry.cost.wood} Holz` : "",
            entry.cost.stone > 0 ? `${entry.cost.stone} Stein` : "",
          ]
            .filter((part) => part !== "")
            .join("  ·  ");
    const pulses = buildPulses(entry.buildMs);
    const time =
      entry.buildMs === 0
        ? "Sofort"
        : `${formatBuildTime(entry.buildMs)} (${pulses} ${pulses === 1 ? "Takt" : "Takte"})`;
    let y = node.y + 24;
    const rows: string[] = [];
    rows.push(`<text x="${node.x + 16}" y="${y}" class="name">${escapeXml(entry.name)}</text>`);
    y += 22;
    rows.push(`<text x="${node.x + 16}" y="${y}" class="cost">${escapeXml(cost)}</text>`);
    y += 18;
    rows.push(
      `<text x="${node.x + 16}" y="${y}" class="time">${escapeXml(time)}${entry.usesBuildSlot ? "  ·  belegt den Bauplatz" : ""}</text>`,
    );
    y += 20;
    for (const line of node.effectLines) {
      rows.push(`<text x="${node.x + 16}" y="${y}" class="effect">${escapeXml(line)}</text>`);
      y += 15;
    }
    y += 6;
    for (const line of node.conditionLines) {
      rows.push(`<text x="${node.x + 16}" y="${y}" class="condition">${escapeXml(line)}</text>`);
      y += 14;
    }
    nodes.push(
      `<g>` +
        `<rect x="${node.x}" y="${node.y}" width="${NODE_WIDTH}" height="${node.height}" rx="12" fill="#1c2233" stroke="${style.color}" stroke-width="2"/>` +
        `<rect x="${node.x}" y="${node.y}" width="8" height="${node.height}" rx="4" fill="${style.color}"/>` +
        rows.join("") +
        `</g>`,
    );
  }

  const legend = (Object.keys(CATEGORY_STYLE) as CatalogCategory[])
    .map((category, index) => {
      const style = CATEGORY_STYLE[category];
      const x = MARGIN + index * 170;
      return `<rect x="${x}" y="${height - 50}" width="14" height="14" rx="3" fill="${style.color}"/><text x="${x + 22}" y="${height - 38}" class="legend">${escapeXml(style.label)}</text>`;
    })
    .join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="MERGEFORGE Tech-Tree">`,
    `<style>text{font-family:'Segoe UI',Arial,sans-serif}.title{font-size:28px;font-weight:700;fill:#f2e9d0}.sub{font-size:14px;fill:#aab4c8}.name{font-size:17px;font-weight:700;fill:#f4f0e4}.cost{font-size:14px;fill:#e8c27a}.time{font-size:13px;fill:#9fd0ff}.effect{font-size:13px;fill:#d8dde8}.condition{font-size:11.5px;fill:#8e9ab0}.legend{font-size:13px;fill:#c9d1e0}.foot{font-size:12.5px;fill:#aab4c8}</style>`,
    `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#7d8aa3"/></marker></defs>`,
    `<rect width="${width}" height="${height}" fill="#10131c"/>`,
    `<text x="${MARGIN}" y="48" class="title">MERGEFORGE · Tech-Tree und Baukosten</text>`,
    `<text x="${MARGIN}" y="72" class="sub">Von links nach rechts freischalten. Ein Takt = 10 Minuten Weltzeit. Es läuft immer nur ein Bau, eine Ausbildung oder eine Reparatur gleichzeitig.</text>`,
    edges.join(""),
    nodes.join(""),
    legend,
    `<text x="${MARGIN}" y="${height - 14}" class="foot">Automatisch erzeugt aus dem Katalog des Spiels (packages/domain/src/catalog.ts). Neu: npm run techtree. Daten-Module erscheinen hier von selbst.</text>`,
    `</svg>`,
    ``,
  ].join("\n");
}
