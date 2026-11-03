# Entwurf: erstes datengetriebenes Beispielmodul „Harzsammler“

Stand: 2026-11-03 · Status: **nur Entwurf, kein Code, kein Branch.** Start erst nach dem Merge von PR 21 nach `dev` (Codex-Entscheidung 2 B).

Vorgabe von Codex: „Harzsammler“ ist ein manifestdefiniertes Waldgebäude mit Kosten, Bauzeit, Icon und +1 Holz je Welttakt, **ohne Kerncodeänderung für das Beispiel**.

## 1. Ehrliche Ausgangslage

Gebäudetypen sind heute im Kern fest verdrahtet:

- `Building.type` ist eine Literal-Union (`"lumber-camp"`, `"quarry"`, …) in `packages/domain/src/index.ts`.
- Kosten, Bauzeit und Ertrag stehen als Konstanten im Code (`LUMBER_CAMP_WOOD_COST`, `LUMBER_CAMP_BUILD_MS`, `LUMBER_CAMP_WOOD_PER_PULSE` …).
- `advanceTime` rechnet die Produktion über `if (building.type === "lumber-camp")`.

Daraus folgt: Das *erste* Modul kann nicht ohne Kernänderung entstehen. Es braucht **einmal** einen generischen Modul-Mechanismus. Danach ist der Harzsammler reine Daten. Der Vorschlag trennt deshalb zwei PRs:

- **PR A, Modul-Grundlage (Kern):** generischer Lader, Validierung und Produktionsregel. Enthält noch kein Beispiel im Kern.
- **PR B, Harzsammler (nur Daten + Test):** eine Manifestdatei, ein Icon, ein Test. Dieser PR ändert keinen Kerncode. Das ist der Beweis für das Backlog-Ziel „Erweiterung ohne Kerncodeänderung“.

## 2. Manifest-Format (Vorschlag, Version 1)

Eine Datei pro Modul, z. B. `modules/harzsammler/module.json`:

```json
{
  "manifestVersion": 1,
  "id": "harzsammler",
  "version": "1.0.0",
  "name": "Harzsammler",
  "building": {
    "placement": { "terrain": ["forest"], "requiresRoadConnection": true },
    "cost": { "wood": 3, "stone": 1 },
    "buildTimeMs": 600000,
    "icon": "icon.svg",
    "production": { "resource": "wood", "amountPerPulse": 1 }
  }
}
```

Hinweise:

- Kosten und Ertrag sind Zahlen in den bestehenden Ressourcen (`wood`, `stone`). Es gibt **keine neue Währung**.
- `buildTimeMs` hängt am Welttakt (`WORLD_PULSE_MS` = 10 Minuten). Der Wert oben ist ein Takt.
- Die Platzierungsregel nutzt nur vorhandene Begriffe (Waldfeld, Straßenanschluss), wie beim Holzfällerlager.
- Die konkreten Kosten sind Platzhalter, die Balance muss der Owner festlegen.

## 3. Regeln der Validierung (Pflicht für PR A)

Ein Manifest wird **abgelehnt**, wenn:

1. `manifestVersion` unbekannt oder `id` leer, zu lang oder nicht `[a-z0-9-]` ist.
2. Unbekannte Felder vorkommen (kein stilles Durchreichen).
3. Kosten oder Ertrag nicht ganze, endliche Zahlen ≥ 0 bzw. > 0 sind, oder über festen Obergrenzen liegen (z. B. Ertrag je Takt ≤ 5, damit die Balance nicht aushebelbar ist).
4. `buildTimeMs` kein Vielfaches von `WORLD_PULSE_MS` ist oder außerhalb von 1…24 Takten liegt.
5. Das Icon nicht existiert, kein SVG ist oder größer als z. B. 8 KB ist (keine großen neuen Assets).
6. Die `id` doppelt vorkommt oder mit einem Kerngebäude kollidiert.
7. Terrain- oder Ressourcennamen nicht aus der festen Liste stammen.

Wichtig für die Sicherheit: Ein Manifest ist **reine Daten, kein Code**. Kein Skript, keine Funktionen, kein Netzwerkzugriff, keine Pfade außerhalb des Modulordners.

## 4. Persistenz und Schema

- Gebäude eines Moduls speichern `type: "module:harzsammler"` plus die Modul-Version. Die Kerntypen bleiben unverändert.
- Spielstand-Schema steigt auf 7 (bewusst, mit Migrationstest wie bei D-011).
- Beim Laden wird jedes Modulgebäude gegen das *aktuelle* Manifest geprüft. Fehlt das Modul oder ist die Version inkompatibel, wird kontrolliert ein neuer Start gemacht und nicht still ein Gebäude verworfen. (Offene Frage 2 unten.)

## 5. Tests, die der Entwurf vorsieht

- **Domain:** Manifest gültig → Gebäude baubar; jede der 7 Ablehnungsregeln einzeln; Kosten abgezogen; nach 1 Takt +1 Holz, nach n Takten +n Holz; Offline-Nachholung; genau einmal gebaut je Feld.
- **Persistenz:** Round-Trip mit Modulgebäude; manipulierte Modul-ID, Version, Kosten und Ertrag werden abgelehnt.
- **UI:** Modulgebäude erscheint mit Icon im Bauangebot, Touch-Zielgröße ≥ 56 px.
- **PR B:** Ein Test, der prüft, dass der Harzsammler-PR keine Datei unter `packages/domain/src` ändert (Diff-Prüfung in der CI).

## 6. Bewusste Grenzen

- Keine Sektoren, kein Netzwerk, kein Login, kein Marktplatz für Module.
- Kein Modul darf Kernregeln ändern, nur bestehende Bausteine (Gebäude, Kosten, Ertrag) kombinieren.
- Keine Contributor-Belohnungen, keine Anbindung an GitHub (kommt mit M4).

## 7. Offene Fragen für Codex und den Owner

1. Soll das Manifest JSON sein, oder lieber TypeScript mit Typen? (Empfehlung: JSON, weil Daten und ohne Code ausführbar.)
2. Was passiert mit einem Spielstand, dessen Modul später entfernt oder inkompatibel geändert wird? (Empfehlung: kontrollierter Neustart wie bei Schema-Fehlern, dokumentiert.)
3. Wo liegen Module? (Vorschlag: `modules/<id>/` im Repo, geladen zur Build-Zeit, nicht zur Laufzeit aus dem Netz.)
4. Sind die Platzhalter-Werte (3 Holz, 1 Stein, 1 Takt, +1 Holz) recht? Der Harzsammler (+1 je Takt) liegt unter dem Holzfällerlager (+2 je Takt).
5. Soll PR A und PR B getrennt bleiben? (Empfehlung: ja, damit PR B den Beweis „ohne Kerncodeänderung“ liefert.)
