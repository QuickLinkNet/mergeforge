# MERGEFORGE — aktueller KI-Handoff

Stand: 2026-11-03 · Übergabe von Codex an die nächste Projektleitung

Dieses Dokument ist der kurze operative Einstieg für eine neue KI. Bei Widersprüchen gelten zuerst `docs/DECISIONS.md`, dann die Projektbibel und die dort definierte Dokumenthierarchie. Historische Pitch-Dokumente sind keine aktuelle technische Vorgabe.

## 1. Produktziel

MERGEFORGE ist ein persistentes Browser-Strategiespiel auf einer prozeduralen Hexwelt. Jeder Spieler gründet ein Dorf, erschließt die Umgebung mit Straßen und Fog of War und entwickelt dieselbe langlebige Welt weiter.

Der besondere Kern: Neue Gebäude, Einheiten, Ressourcen, Ereignisse, Minispiele und spätere PvE-/PvP-Systeme entstehen durch geprüfte GitHub-Pull-Requests. Beiträge dürfen bestehende Welten nicht still beschädigen. Contributor-Status ist Anerkennung, aber kein spielerischer Vorteil und keine Voraussetzung zum Spielen.

Visuelle Richtung: **Stil A „Diorama Lite“** — moderne isometrische Fantasy-Hexfelder, klar lesbar und für KI-gestützte Asset-Produktion geeignet.

## 2. Wann das MVP vollständig ist

Das MVP umfasst M1 bis M4 aus `docs/MERGEFORGE_MVP_Backlog_v1.md`:

1. Ein neuer Spieler kann im Browser eine deterministische Hexwelt spielen: Dorf, Fog, Straßen, Holz und Stein.
2. Bauaufträge und Produktion laufen im 10-Minuten-Welttakt und holen begrenzten Offline-Fortschritt nach.
3. Der Wegfinder erkundet gezielt unbekannte Felder.
4. Der sieben Kapitel lange Prolog endet mit Signalwerk, Resonanzkern, Relaisreparatur und einem bewussten Fernsignal-Scan.
5. Mindestens ein Beispielgebäude wird als reines Datenmodul eingebunden, ohne dass sein PR Kerncode ändern muss.
6. GitHub-Login öffnet über eine interne unveränderliche MERGEFORGE-Spieler-ID immer denselben Online-Spielstand.
7. Mindestens zwei Testspieler erhalten getrennte, regelkonforme Startsektoren.
8. CI prüft Module und der Releaseweg lautet `feature → dev → main`.

Der aktuelle Stand erfüllt den spielbaren lokalen Einzelspieler-Prolog, aber noch nicht die Modulschnittstelle und Online-/Contributor-Grundlage vollständig.

## 3. Verifizierter Git- und Projektstand

- Repository: `QuickLinkNet/mergeforge`
- Integrationsbranch: `dev`; stabile Releases ausschließlich über `main`
- `dev` und `origin/dev`: Commit `48b08b9`
- PR 21 (Kapitel 7), PR 22 (Harzsammler-Entwurf) und PR 23 (Manifest-Validator) sind nach `dev` gemerged.
- Letzter gemeinsamer Check auf `dev`: **254 Tests und Produktions-Build grün** (`npm run check`, 2026-11-03).
- **PR 24 ist offen und grün:** `feature/m4-2-module-persistence`, Schema 7, Modulreferenzen und `blocked` statt Reset.
- **Gestapelter Arbeitsbranch ohne PR:** `feature/m4-3-module-loader` baut auf PR 24 auf und enthält aktuell Lader **und** Harzsammler-Daten in einem Commit. Vor Einreichung muss die bestätigte Trennung von PR A (Kern) und PR B (reine Beispieldaten) gewahrt werden.
- Keine bekannten ungepushten Änderungen zum Zeitpunkt dieser Übergabe.

## 4. Bereits umgesetzt

### M1 — frühe Vertikalscheibe

- deterministische prozedurale Hexwelt, Dorf, Pan/Zoom und Fog of War
- lückenloses Hexraster und zusammenhängender Straßenbau
- Straßennachbarn werden aufgedeckt; Kosten werden validiert
- Holzfunde, Holzfällerlager, Produktion, Lagergrenzen und lokaler Spielstand

### M2 — vollständiger Kernloop

- garantierte erreichbare Steinquelle und deterministischer Relaisstandort
- Steinfunde, Steinbruch und Steinproduktion
- Wegfinder, Straßenbewegung, Expeditionsladungen und Einzelhex-Vermessung
- Vermesserzelt und Prolog-Kapitel 3–5
- persistente, einmalige und geordnete Kapitelereignisse

### M3 — Signalwerk und sieben Kapitel

- deterministisches, lösbares 5×5-Signalwerk für Maus und Touch
- einzigartiger Resonanzkern, Relaiswerkstatt und 30-minütige Relaisreparatur
- Kapitel 6 endet mit fertiger Reparatur
- Kapitel 7 erfordert danach ausdrücklich die kostenlose einmalige Aktion „Fernsignal scannen“
- zwei deterministische Fernsignale mit sechs Hexrichtungen und grobem Distanzband; keine exakten Fremdkoordinaten
- Spielstand-Schema 6; Schema 5 wird migriert, ältere Schemata bleiben inkompatibel

### Beginn M3.3/M4-Modulgrundlage

- JSON-Manifestvertrag und Harzsammler-Entwurf dokumentiert
- reiner Manifest-Validator mit strikten Feldern und Tests gemerged
- Grenzen: Kosten je Ressource 0–50, Produktion 1–5 je Takt, Bauzeit 1–24 Takte, Icon nur sicherer lokaler `.svg`-Dateiname

## 5. Nächste Arbeiten — in dieser Reihenfolge

1. **PR 24 prüfen und mergen:** Schema 7, Migration 5/6 → 7, Modulreferenzen, Rückgabe `kind: "blocked"`, unveränderten Spielstand bewahren und „Erneut prüfen“.
2. **Gestapelten Lader sauber trennen:** Nach PR 24 vom aktualisierten `dev` arbeiten. PR A enthält nur generischen Lader/Registry, `modules/<id>/`, Icon-Existenz und maximal 8 KB, Validierung, Exporte sowie notwendige generische Kernanbindung.
3. **Generisches Modulgebäude vollständig spielbar machen:** Platzierung, Kosten, Bauauftrag, Weltpuls-Produktion, Persistenz und UI müssen datengetrieben funktionieren. Keine Harzsammler-Sonderfälle im Kern.
4. **PR B als Beweis:** ausschließlich `modules/harzsammler/module.json`, `icon.svg` und modulbezogene Tests. Werte: 3 Holz, 1 Stein, 1 Takt Bauzeit, +1 Holz je Takt, Wald und Straßenanschluss.
5. **M4 Online:** GitHub-Login und interne MERGEFORGE-ID, danach Online-Persistenz mit getrennten Startsektoren, schließlich PR-/Release-Automation.

Kein Kapitel 8 vor Abschluss dieses MVP-Backlogs.

## 6. Verbindlicher Modul- und Persistenzvertrag

- Manifest ist JSON und reine Daten, kein TypeScript und kein ausführbarer Code.
- Module liegen zur Build-Zeit unter `modules/<id>/`; kein Laufzeit-Download aus dem Netz.
- IDs und Versionen sind stabil. Kerngebäude-IDs dürfen nicht kollidieren.
- Fehlt ein benötigtes Modul oder ist seine Version inkompatibel, bleibt der gespeicherte Stand **bytegenau unangetastet** und das Laden liefert `blocked`.
- Die UI nennt fehlende ID und Version und bietet „Erneut prüfen“; kein stilles Entfernen, kein automatischer Neustart.
- Schemaänderungen brauchen Migrationstest und Decision-Log-Eintrag.
- PR A (allgemeiner Kernmechanismus) und PR B (Harzsammler als Daten) bleiben getrennt.

## 7. Spieler- und Contributor-Identität

- Jeder Spieler erhält eine interne unveränderliche MERGEFORGE-ID.
- Im MVP wird sie mit der stabilen numerischen GitHub-User-ID verbunden; der GitHub-Name ist nur Anzeige-Metadatum.
- Spieler und Contributor sind getrennte Rollen.
- Ein gemergter PR darf einen Chronik-/Kosmetikeintrag erzeugen, aber keine Ressourcen, Adminrechte oder unfairen Vorteile.
- Später bevorzugt eine GitHub App mit minimalen Rechten. Registrierung erst, wenn Callback- und Webhook-URLs feststehen.

## 8. Technik und wichtige Grenzen

- Node.js 24+, pnpm 11, TypeScript strict, React/Vite, PixiJS 8, Vitest/fast-check/Playwright
- Domain, Weltgenerierung und Renderer bleiben voneinander getrennt.
- Kein lokaler PHP-Server.
- Ein späteres Backend läuft gegen die vom Owner bereitgestellte Online-API.
- Wenn FTP-Ziel und Secrets bereitstehen, muss `npm run deploy` den vollständigen Upload erledigen.
- Secrets niemals committen; fehlende Deploy-Konfiguration muss sicher abbrechen.

Lokale Befehle:

```text
pnpm install
npm run dev
npm run check
```

## 9. Arbeits- und Abnahmeregeln

- Kleine Branches von aktuellem `dev`: `feature/*`, `fix/*`, `docs/*`.
- Gewöhnliche PRs ausschließlich nach `dev`; `main` nur über geprüften Release-PR.
- Conventional-Commit-Präfixe wie `feat:`, `fix:`, `docs:`.
- Vor Merge: Diff fachlich prüfen, CI grün, lokal `npm run check` und `git diff --check`.
- Keine stillen Änderungen an Kosten, Timern, Speicherschema oder bereits bestätigtem Spielfluss.
- Bestehende Nutzeränderungen bewahren; keine Force-Pushes oder destruktiven Git-Kommandos.
- Eine andere KI darf entwickeln, aber Abnahme erfolgt anhand dieser Verträge und der Tests, nicht aufgrund ihrer Selbstaussage.

## 10. Dokumente, die eine neue KI zuerst lesen soll

1. dieses Dokument
2. `docs/DECISIONS.md`
3. `docs/MERGEFORGE_Project_Bible_and_Agent_Handoff.md`
4. `docs/MERGEFORGE_Module_Draft_Harzsammler.md`
5. `docs/MERGEFORGE_Playable_Blueprint_v1.md`
6. `docs/MERGEFORGE_World_and_Domain_Contract_v1.md`
7. `CONTRIBUTING.md`

Konzeptbilder liegen unter `concept-art/`; die bestätigte Richtung ist insbesondere `concept-art/phase-2/04-style-a-diorama-lite.png`.

## 11. Noch vom Owner benötigt

- Für M4: endgültige Online-Domain/API-URL, FTP-Zielordner und Secrets außerhalb des Repositories.
- Danach: GitHub-App-Callback und Webhook-URL festlegen und App registrieren.

Bis diese Daten vorliegen, kann die Modulschnittstelle vollständig lokal abgeschlossen werden; Backend-Ziele dürfen nicht geraten werden.
