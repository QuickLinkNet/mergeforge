import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hasPrologueEvent, type GameState, type WorldSnapshot } from '@mergeforge/domain';
import {
  mountHexWorld,
  type HexSelectionEvent,
  type HexWorldViewState,
  type MountedHexWorld,
} from '@mergeforge/renderer-pixi';
import type { BootstrapResult } from '../game/bootstrap';
import {
  buildRendererView,
  rendererBuildings,
  rendererSurveyTent,
  worldForRenderer,
  type RendererViewInput,
} from '../game/rendererState';

export type ViewState = 'loading' | 'ready' | 'error';

export interface HexRendererInput extends Omit<RendererViewInput, 'roadTileKeys' | 'buildings' | 'roadPreviewOk' | 'surveyPreviewOk'> {
  /** Road and survey dry runs of the selected tile (null when not offered). */
  readonly roadPreview: { readonly ok: boolean } | null;
  readonly surveyPreview: { readonly ok: boolean } | null;
  readonly bootstrap: BootstrapResult;
  readonly gameState: GameState | null;
  readonly onHexSelect: (event: HexSelectionEvent) => void;
  /** Fired when the player starts dragging the map (used to fold away the build menu). */
  readonly onMapDrag: () => void;
}

/** Mounts the Pixi map once, then feeds it the live world and selection overlay. */
export function useHexRenderer(input: HexRendererInput) {
  const { bootstrap, gameState, onHexSelect, onMapDrag } = input;
  const mapHostRef = useRef<HTMLDivElement>(null);
  const onMapDragRef = useRef(onMapDrag);
  onMapDragRef.current = onMapDrag;
  const focusTiles = useCallback((keys: readonly string[]) => rendererRef.current?.focusOn(keys), []);
  const rendererRef = useRef<MountedHexWorld | undefined>(undefined);
  const latestRenderRef = useRef<{
    world: WorldSnapshot;
    view: HexWorldViewState;
  } | undefined>(undefined);
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const effectiveWorld = useMemo(
    () => (gameState === null ? null : worldForRenderer(gameState)),
    [gameState],
  );
  const { selectedTile, placementKeys, roadPreview, surveyPreview, guidance, findEffects, pathfinder, surveyTent, relayDiscovered } = input;
  const rendererView = useMemo<HexWorldViewState>(
    () => buildRendererView({
      selectedTile,
      roadTileKeys: gameState?.roadTileKeys,
      buildings: gameState?.buildings,
      placementKeys,
      roadPreviewOk: roadPreview?.ok === true,
      surveyPreviewOk: surveyPreview?.ok === true,
      guidance,
      findEffects,
      pathfinder,
      surveyTent,
      relayDiscovered,
    }),
    [gameState?.buildings, gameState?.roadTileKeys, guidance, findEffects, pathfinder, placementKeys, relayDiscovered, roadPreview, selectedTile, surveyPreview, surveyTent],
  );

  if (effectiveWorld !== null) latestRenderRef.current = { world: effectiveWorld, view: rendererView };

  useEffect(() => {
    const host = mapHostRef.current;
    if (host === null || !bootstrap.ok) {
      if (!bootstrap.ok) {
        setErrorMessage(bootstrap.error);
        setViewState('error');
      }
      return;
    }

    let disposed = false;
    let renderer: MountedHexWorld | undefined;
    const firstWorld = worldForRenderer(bootstrap.state);
    const firstPathfinder = bootstrap.state.units[0];

    setViewState('loading');
    void mountHexWorld(host, firstWorld, {
      selectedTileKey: null,
      roadTileKeys: bootstrap.state.roadTileKeys,
      roadPreviewTileKeys: [],
      buildings: rendererBuildings(bootstrap.state.buildings),
      findEffects: [],
      wayfinder: firstPathfinder === undefined
        ? null
        : {
            tileKey: firstPathfinder.tileKey,
            state: firstPathfinder.status,
          },
      surveyTargetTileKey: null,
      surveyTent: rendererSurveyTent(bootstrap.state.buildings.find((building) => building.type === 'survey-tent')),
      relayDiscoveryHighlight: hasPrologueEvent(bootstrap.state, 'relay_discovered'),
      onHexSelect,
      onMapDrag: () => onMapDragRef.current(),
    })
      .then((mountedRenderer) => {
        if (disposed) {
          mountedRenderer.destroy();
          return;
        }
        renderer = mountedRenderer;
        rendererRef.current = mountedRenderer;
        const latest = latestRenderRef.current;
        if (latest !== undefined) mountedRenderer.update(latest.world, latest.view);
        setViewState('ready');
      })
      .catch((error: unknown) => {
        if (disposed) return;
        setErrorMessage(
          error instanceof Error ? error.message : 'Die Kartenansicht konnte nicht geladen werden.',
        );
        setViewState('error');
      });

    return () => {
      disposed = true;
      rendererRef.current = undefined;
      renderer?.destroy();
    };
  }, [bootstrap, onHexSelect]);

  useEffect(() => {
    if (effectiveWorld !== null) rendererRef.current?.update(effectiveWorld, rendererView);
  }, [effectiveWorld, rendererView]);

  return { mapHostRef, viewState, errorMessage, focusTiles };
}
