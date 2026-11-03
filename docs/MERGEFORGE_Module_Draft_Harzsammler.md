# Entwurf: erstes datengetriebenes Beispielmodul „Harzsammler“

Stand: 2026-11-03 · Status: **nur Entwurf, kein Code, kein Branch; Codex-Antworten eingearbeitet.** Start erst nach dem Merge von PR 21 nach `dev` (Codex-Entscheidung 2 B).

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
- Beim Laden wird jedes Modulgebäude gegen das *aktuelle* Manifest geprüft. Fehlt das Modul oder ist die Version inkompatibel, wird der Spielstand **unverändert gesperrt** (weder Neustart noch stilles Entfernen von Gebäuden). Die Oberfläche meldet klar, welches Modul in welcher Version fehlt, und ermöglicht die Wiederherstellung, etwa durch Hinzufügen des Moduls. Der gespeicherte Stand wird dabei nicht überschrieben. (Codex-Entscheidung 2.)

## 5. Tests, die der Entwurf vorsieht

- **Domain:** Manifest gültig → Gebäude baubar; jede der 7 Ablehnungsregeln einzeln; Kosten abgezogen; nach 1 Takt +1 Holz, nach n Takten +n Holz; Offline-Nachholung; genau einmal gebaut je Feld.
- **Persistenz:** Round-Trip mit Modulgebäude; manipulierte Modul-ID, Version, Kosten und Ertrag werden abgelehnt.
- **UI:** Modulgebäude erscheint mit Icon im Bauangebot, Touch-Zielgröße ≥ 56 px.
- **PR B:** Ein Test, der prüft, dass der Harzsammler-PR keine Datei unter `packages/domain/src` ändert (Diff-Prüfung in der CI).

## 6. Bewusste Grenzen

- Keine Sektoren, kein Netzwerk, kein Login, kein Marktplatz für Module.
- Kein Modul darf Kernregeln ändern, nur bestehende Bausteine (Gebäude, Kosten, Ertrag) kombinieren.
- Keine Contributor-Belohnungen, keine Anbindung an GitHub (kommt mit M4).

## 7. Entscheidungen (Codex, 2026-11-03)

1. **Manifest-Format:** JSON (nur Daten, kein ausführbarer Code).
2. **Fehlendes oder inkompatibles Modul:** Spielstand unverändert sperren, fehlendes Modul klar melden, Wiederherstellung ermöglichen. Kein Neustart, kein stilles Entfernen.
3. **Ablageort:** `modules/<id>/` im Repo, zur Build-Zeit geladen, nicht zur Laufzeit aus dem Netz.
4. **Platzhalter-Werte:** 3 Holz, 1 Stein, 1 Takt Bauzeit, +1 Holz je Takt sind in Ordnung. Die endgültige Balance legt der Owner fest.
5. **PR-Aufteilung:** PR A (Modul-Lader und Validierung, Kern) und PR B (Harzsammler als reine Daten) bleiben getrennt.

## 8. Noch offen (für PR A)

- Wie genau sieht die „Wiederherstellung“ aus? Vorschlag: eine Sperrseite mit Modul-ID und Version, dem Hinweis, wo das Modul liegen muss, und einem Knopf „Erneut prüfen“. Der Spielstand wird erst nach erfolgreicher Prüfung geladen. Ein Export des gesperrten Standes ist wünschenswert, aber nicht Teil des MVP.
- Braucht die Sperre eine eigene Persistenz-Rückgabeart (`kind: 'blocked'`) neben `loaded` und `reset`? Vorschlag: ja, damit die UI sie nicht mit einem Neustart verwechselt.
