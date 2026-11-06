import './CameraHints.css';

/** Map controls legend in the bottom-right corner (touch text on phones). */
export function CameraHints() {
  return (
    <aside className="camera-hints" aria-label="Kartensteuerung">
      <span><kbd>Klick</kbd> Feld wählen</span><span><kbd>Drag</kbd> Karte bewegen</span><span><kbd>Scroll</kbd> Zoomen</span>
      <span className="touch-hint">Tippen zum Wählen · Ziehen und spreizen</span>
    </aside>
  );
}
