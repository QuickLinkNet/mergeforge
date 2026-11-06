/** Central sizes and scale limits for the Pixi hexworld renderer. */
export const HEX_SIZE = 42;
export const MIN_SCALE = 0.45;
export const START_SCALE_MIN = 0.95;
export const MAX_SCALE = 2.2;
/** Upper bound for the initial fit scale. */
export const START_SCALE_MAX = 1.1;
/** Viewport padding (px) used when fitting the world at mount time. */
export const FIT_PADDING = 48;
/** Minimum screen distance (px) kept between the world edge and the viewport edge while panning. */
export const EDGE_GUARD = 84;
/** Pointer travel (px) after which a press counts as a drag instead of a tap. */
export const DRAG_THRESHOLD = 5;
/** Wheel delta to zoom exponent factor. */
export const WHEEL_ZOOM_SPEED = 0.0012;

/** Canvas clear color. */
export const BACKGROUND_COLOR = 0x101923;

export const terrainColors: Readonly<Record<string, { face: number; edge: number }>> = {
  grass: { face: 0x769a5d, edge: 0xa3bf7e },
  meadow: { face: 0x86aa68, edge: 0xb1cb88 },
  plains: { face: 0x8caa65, edge: 0xb8ca83 },
  forest: { face: 0x4f7952, edge: 0x719966 },
  hills: { face: 0x8c8a73, edge: 0xb3ad8d },
  stone: { face: 0x7c8586, edge: 0xa6ada9 },
  mountain: { face: 0x737c80, edge: 0xa0a8a8 },
  water: { face: 0x3e7188, edge: 0x68a1b2 },
  sand: { face: 0xc2a46a, edge: 0xd8c083 },
};

/** Fogged (not yet visible) tile appearance. */
export const fogColors = {
  face: 0x1a2431,
  edge: 0x344254,
  hazeInner: 0x536174,
  hazeOuter: 0x738196,
} as const;

/** Selection, preview and survey overlay colors. */
export const overlayColors = {
  selectionFill: 0xf8cf69,
  selectionStroke: 0xffdc78,
  roadPreviewOutlineFill: 0x75e4dd,
  roadPreviewOutlineStroke: 0x9ff4ec,
  surveyTargetFill: 0x62e2d8,
  surveyTargetStroke: 0x9ffff4,
  surveyTargetRing: 0xe3fffb,
  surveyTargetCross: 0xffffff,
} as const;

/** Built road vs. road preview colors. */
export const roadColors = {
  built: { underlay: 0x3c2b20, road: 0xb68b55, highlight: 0xe5c68b, nodeFill: 0xb9905b, nodeStroke: 0x5a3d27 },
  preview: { underlay: 0x254953, road: 0x58c4c7, highlight: 0xb9ffff, nodeFill: 0x62d1cf, nodeStroke: 0xd5ffff },
} as const;
