# Roadmap V2 (ab 2026-11-06)

Auslöser: Test über Nacht. Lager voll (300 Holz, 140 Stein), 6/12 Ladungen, nichts mehr zu bauen. Die Nachbarn liegen in getrennten Welten und lassen sich nicht erreichen.

## Qualitätsregeln für alles Folgende

- **Atomic Design** im Frontend: `atoms` → `molecules` → `organisms` → `templates` → `pages`.
- **Zentrales Design-System:** Farben, Abstände, Radien, Schatten, Schrift und Z-Ebenen nur als Tokens an einer Stelle. Komponenten verwenden keine Rohwerte.
- **Keine Datei über 500 Zeilen** (Code, CSS und Tests).
- Verhalten ändert sich bei reinen Umbauten nicht; alle Tests bleiben grün.

## Phasen

| Phase | Inhalt | Größe |
|---|---|---|
| A | Umbau: Design-System, Atomic Design, Dateien unter 500 Zeilen (Web, Domain, Renderer, Persistence/Online) | 1 bis 2 Tage |
| B | Rohstoff-Senken: Lager-Ausbau, weitere Gebäude/Stufen, Kapitel 8 als Ziel | Tage |
| C | Nachbar als Dorf am Inselrand sichtbar, Wegfinder-Expedition zum Grenzpunkt, „Kontakt aufnehmen“ | ca. 1 Woche |
| D | Gemeinsame, zusammenhängende Welt: Entwurf, Entscheidung (D-023), dann Umsetzung mit Server-Prüfung des Spielstands | mehrere Wochen |

## Abhängigkeiten

- B baut auf dem sauberen Domain-Paket aus A auf.
- D braucht die serverseitige Prüfung (H1/H2 in `HARDENING_AUDIT.md`), sonst kann man Bestände fälschen.
