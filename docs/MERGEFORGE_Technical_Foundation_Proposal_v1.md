# MERGEFORGE – Technical Foundation Proposal v1

**Status:** Am 30. Oktober 2026 durch den Projektowner freigegeben

**Datum:** 30. Oktober 2026

**Geltungsbereich:** M1 – Early Playable Vertical Slice

## Entscheidungsvorschlag

MERGEFORGE startet als schlanker TypeScript-Monorepo mit einer klar getrennten Spiellogik und einer PixiJS-Kartenansicht:

- Node.js 24 LTS
- pnpm Workspace
- TypeScript im Strict Mode
- React 19 und Vite für Oberfläche und App-Hülle
- PixiJS 8 für die zusammenhängende Hexkarte
- Vitest für schnelle Modul- und Regeltests
- fast-check für deterministische Welt- und Regeltests
- Playwright für die wichtigsten Browser-Abläufe und visuelle Regressionen
- CSS Modules und natives CSS; zunächst kein UI-Framework und keine globale State-Bibliothek

Für M1 wird PixiJS gezielt mit WebGL gestartet. WebGPU bleibt eine spätere, messbare Optimierungsoption und wird nicht Teil des ersten Risikopakets.

## Warum diese Kombination

React bleibt auf Menüs, Statusleisten, Dialoge und den App-Rahmen begrenzt. PixiJS übernimmt ausschließlich die interaktive Weltkarte. So muss die Hexwelt nicht als großer DOM-Baum gerendert werden, während die restliche Browseroberfläche einfach zugänglich und erweiterbar bleibt.

Die eigentlichen Spielregeln leben unabhängig von beiden Technologien. Ein Agent kann deshalb Weltgenerierung, Straßenregeln oder Wirtschaft testen, ohne Browser, Grafik oder Datenbank zu starten. Spätere Contributor können Renderer und UI austauschen, ohne gespeicherte Weltregeln neu zu erfinden.

## Vorgesehene Struktur

```text
apps/
  web/                 React/Vite-App und Zusammensetzung
packages/
  domain/              reine Spielregeln und serialisierbare Zustände
  worldgen/            Seed, Hexkoordinaten, Gelände und Spawnregeln
  renderer-pixi/       Karte, Kamera, Auswahl und visuelle Eingabe
tests/
  e2e/                 kritische Browserabläufe
docs/                  Verträge, Entscheidungen und Abnahmen
```

## Harte Abhängigkeitsregel

```text
worldgen       -> domain
renderer-pixi  -> lesbare Domain-/View-Typen
web            -> domain + worldgen + renderer-pixi
```

`domain` kennt weder React noch PixiJS, Browser, Datenbank, `Date.now()` oder `Math.random()`. Zeit und Zufall werden als kontrollierte Eingaben übergeben. Jeder persistierte Zustand bleibt versioniert und serialisierbar.

## M1-Testvertrag

- Gleicher Seed erzeugt dieselbe Startregion.
- Straßenbau und Aufdeckung sind als reine Regeln testbar.
- Ungültige Aktionen verändern den Zustand nicht.
- Einmalfunde können nicht doppelt abgeholt werden.
- Zeitnachholung nutzt einen injizierten Zeitgeber.
- Ein Browser-Smoke-Test prüft Start, Straße, Holzloop und Reload.
- Ein visueller Referenztest schützt die bestätigte Diorama-Lite-Richtung.

## Bewusst vertagt

Folgende Entscheidungen werden erst getroffen, wenn ein akzeptiertes Issue sie benötigt:

- Server-Framework und Hosting
- relationale Datenbank und Migrationen
- GitHub-App, Login und Contributor-Synchronisierung
- Echtzeit-Mehrspieler und Konfliktauflösung
- Asset-Pipeline jenseits der ersten Karten- und UI-Assets
- WebGPU, Worker und weitere Performance-Schichten

Damit bleibt M1 lokal spielbar und testbar, ohne die spätere Online-Architektur vorwegzunehmen.

## Backend- und Deployment-Grenze

- Für M1 wird kein lokaler PHP-Server eingerichtet oder vorausgesetzt.
- Ein Backend entsteht erst, wenn ein akzeptiertes Issue einen konkreten Online-Anwendungsfall verlangt.
- Sobald der Projektowner Zielordner und Zugangsdaten bereitstellt, muss `npm run deploy` den vollständigen Upload zum vorgesehenen FTP-Ziel ausführen.
- Integrationstests dürfen dann gegen die freigegebene Online-API laufen.
- FTP-Zugangsdaten, API-Schlüssel und Zielkonfigurationen bleiben außerhalb des Repositories und werden ausschließlich über lokale Umgebungsvariablen oder geschützte CI-Secrets eingespeist.
- Der Deploy-Befehl muss bei fehlender Konfiguration verständlich abbrechen und darf niemals ein geratenes Ziel verwenden.

## Umsetzungsfreigabe

Issue M1.1 wird auf `feature/m1-1-hexworld-view` umgesetzt. Architekturabweichungen müssen im Pull Request begründet werden; neue Bibliotheken benötigen einen konkreten Bedarf und dürfen die Domain-Grenze nicht aufweichen.

## Primärquellen

- [Node.js Release-Linien](https://nodejs.org/en/about/previous-releases)
- [pnpm Workspaces](https://pnpm.io/workspaces/)
- [TypeScript Project References](https://www.typescriptlang.org/tsconfig/references.html)
- [React Installation](https://react.dev/learn/installation)
- [Vite – TypeScript](https://vite.dev/guide/features)
- [PixiJS – Einführung](https://pixijs.com/8.x/guides/getting-started/intro)
- [PixiJS – Renderer](https://pixijs.com/guides/components/renderers/)
- [PixiJS – Scene Graph](https://pixijs.com/8.x/guides/concepts/scene-graph)
- [Vitest](https://vitest.dev/guide/)
- [fast-check](https://fast-check.dev/docs/introduction)
- [Playwright](https://playwright.dev/docs/intro)
