import { Application } from "pixi.js";

import { BACKGROUND_COLOR } from "./theme.js";

export interface HexWorldScene {
  readonly app: Application;
  readonly initialRect: DOMRect;
  /** Restores the container styles changed while mounting. */
  restoreContainerStyle(): void;
}

/** Creates and initializes the Pixi application and attaches its canvas to the container. */
export async function createHexWorldScene(container: HTMLElement): Promise<HexWorldScene> {
  const initialRect = container.getBoundingClientRect();
  const app = new Application();
  await app.init({
    width: Math.max(1, Math.round(initialRect.width)),
    height: Math.max(1, Math.round(initialRect.height)),
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    backgroundColor: BACKGROUND_COLOR,
    backgroundAlpha: 1,
    preference: "webgl",
  });

  const previousTouchAction = container.style.touchAction;
  const previousOverflow = container.style.overflow;
  container.style.touchAction = "none";
  container.style.overflow = "hidden";
  app.canvas.style.display = "block";
  app.canvas.style.width = "100%";
  app.canvas.style.height = "100%";
  container.appendChild(app.canvas);

  return {
    app,
    initialRect,
    restoreContainerStyle(): void {
      container.style.touchAction = previousTouchAction;
      container.style.overflow = previousOverflow;
    },
  };
}
