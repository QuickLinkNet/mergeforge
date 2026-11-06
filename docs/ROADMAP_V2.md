# Roadmap V2 (ab 2026-11-06)

Auslöser: Test über Nacht. Lager voll (300 Holz, 140 Stein), 6/12 Ladungen, nichts mehr zu bauen. Die Nachbarn liegen in getrennten Welten und lassen sich nicht erreichen.

## Qualitätsregeln für alles Folgende

- **Atomic Design** im Frontend: `atoms` → `molecules` → `organisms` → `templates` → `pages`.
- **Zentrales Design-System:** Farben, Abstände, Radien, Schatten, Schrift und Z-Ebenen nur als Tokens an einer Stelle. Komponenten verwenden keine Rohwerte.
- **Keine Datei über 500 Zeilen** (Code, CSS und Tests).
- Verhalten ändert sich bei reinen Umbauten nicht; alle Tests bleiben grün.

## Phasen

| Phase | Inhalt | Größe | Status |
|---|---|---|---|
| A | Umbau: Design-System, Atomic Design, Dateien unter 500 Zeilen (Web, Domain, Renderer, Persistence/Online) | 1 bis 2 Tage | erledigt |
| B | Rohstoff-Senken: Lager-Ausbau, weitere Gebäude/Stufen, Kapitel 8 als Ziel | Tage | umgesetzt (D-023), Branch `feat/phase-b-sinks` |
| C | Nachbar als Dorf am Inselrand sichtbar, Wegfinder-Expedition zum Grenzpunkt, „Kontakt aufnehmen“ | ca. 1 Woche | offen |
| D | Gemeinsame, zusammenhängende Welt: Entwurf, Entscheidung (D-024), dann Umsetzung mit Server-Prüfung des Spielstands | mehrere Wochen | offen |

### Phase B im Detail (D-023)

- **Lagerhaus** im Dorf, 3 Stufen (60/30, 120/60, 200/100 Holz/Stein; 30, 60, 90 Min). Lager Holz 300 → 450 → 600 → 800, Stein 150 → 225 → 300 → 400, erst nach Fertigstellung.
- **Holzfäller-Ausbau** (50/20, 20 Min): 2 → 4 Holz pro Takt. **Steinbruch-Ausbau** (40/30, 30 Min): 1 → 2 Stein pro Takt.
- **Kapitel 8 „Das Gründerwerk“:** Lagerhaus Stufe 1 und beide Ausbauten. Der Abschlusstext kündigt Phase C an.
- Spielstand-Schema 8 mit Migration von Schema 7; Server erlaubt Bestände bis 800/400.

## Abhängigkeiten

- B baut auf dem sauberen Domain-Paket aus A auf.
- D braucht die serverseitige Prüfung (H1/H2 in `HARDENING_AUDIT.md`), sonst kann man Bestände fälschen.
