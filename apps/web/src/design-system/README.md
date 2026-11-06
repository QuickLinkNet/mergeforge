# MERGEFORGE Design-System

Die Web-UI folgt Atomic Design. Alle Stile hängen an einem zentralen Satz von Design-Tokens.

## Dateien

- `tokens.css` – **alle** Rohwerte als CSS-Variablen auf `:root`: Farben, Verläufe, Schatten,
  Abstände (`--space-*`), Radien (`--radius-*`), Schriftgrößen (`--font-size-*`), Schriftgewichte,
  Ebenen (`--z-*`), HUD-Positionen (`--layout-*`) und Komponentengrößen (`--size-*`).
  Nummerierte Skalen entsprechen CSS-Pixeln (`--space-12` = 12px).
- `base.css` – Reset und Seiten-Grundwerte (`:root`, `html`, `body`, `#root`, Keyframes).
- `designSystem.test.ts` – prüft die Regeln unten automatisch.

## Regeln

1. Ladereihenfolge: `tokens.css` → `base.css` → Komponenten-CSS (siehe `main.tsx`; jede
   Komponente importiert ihr eigenes `.css`).
2. Außerhalb von `tokens.css` keine Rohwerte: keine Hex-Farben, kein `rgb()`/`hsl()`, keine
   `px`-Werte. Ausnahme: Breakpoints in `@media`-Bedingungen (CSS-Variablen sind dort nicht
   erlaubt). Verwendete Breakpoints: `850px`, `580px` (Telefon), `900px` / Höhe `700px`
   (kleine Fenster).
3. Jede verwendete Variable muss in `tokens.css` definiert sein.
4. Keine Datei (TS, TSX, CSS) erreicht 500 Zeilen.
5. Klassen bleiben komponentenlokal: eine Komponente stylt ihre eigenen Klassen. Kontextregeln
   (z. B. `.mission-card .prototype-badge` oder `.game-shell.is-halted .top-bar`) stehen beim
   Elternteil, damit die Kaskade nicht von der Importreihenfolge abhängt.

## Ebenen

- `components/atoms` – Button, IconButton, Badge, ProgressBar, Toast, Symbol, ResourceDot
- `components/molecules` – BuildCardHeading, ResourceChip, MissionHint, Banner, BuildPreview,
  BuildTimer, SignalList
- `components/organisms` – TopBar, MissionPanel, BuildMenu, BuildCard (+ Varianten), MarketPanel,
  SignalwerkDialog, RadioContacts, …
- `components/templates` – GameLayout
- `pages` – GamePage, OnlineGate, AccessGate, AdminPage
