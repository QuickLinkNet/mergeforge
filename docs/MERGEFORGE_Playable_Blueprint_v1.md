# MERGEFORGE — Spielbare Blaupause v1

**Status:** zur Abnahme, noch keine Implementierungsfreigabe  
**Ziel:** Der erste Spieler erlebt innerhalb von 15 Minuten den vollständigen kleinen Kernloop.

## Referenzmoment nach 15 Minuten

Der Spieler hat Kapitel 1 und 2 abgeschlossen, fünf bis sechs verbundene Straßenfelder gebaut, ein aktives Holzlager, einen zweiten Straßenarm begonnen und den Wegfinder in Ausbildung.

> Straße → Fog aufdecken → Fund einsammeln → Produktionsort anschließen → Welttakt → weiter expandieren

## Die ersten 15 Minuten

Referenzbedingungen: Start direkt nach einem Welttakt, Wald über vier Straßenfelder erreichbar, Startbestand 12 Holz und 6 Stein.

| Zeit | Aktion | Direktes Ergebnis |
|---:|---|---|
| 00:00 | Karte erscheint | Dorf und sechs Nachbarhexes sichtbar; Kapitelziel nennt zwei Straßen |
| 00:45 | Erste Straße Richtung Wald | 1 Holz abgezogen; angrenzende Hexes werden sofort sichtbar |
| 01:15 | Fallholz einsammeln | Einmaliger Fund wird ohne Zwischendialog eingelagert |
| 01:45 | Zweite Straße | Kapitel 1 endet; Waldlinie wird als nächstes Ziel markiert |
| 02:45–03:30 | Zwei weitere Straßen zum Wald | Waldstandort erhält Verbindung zum Dorf |
| 04:00 | Holzlager beauftragen | 4 Holz/1 Stein reserviert; Bau endet am nächsten Welttakt |
| 05:00–09:59 | Seitenweg Richtung Stein beginnen | Spieler erkundet und sammelt weiter, statt auf den Timer zu warten |
| 10:00 | Welttakt | Holzlager wird aktiv und schreibt direkt seine ersten 2 Holz gut |
| 10:15 | Kapitel 2 endet | Steinlinie wird aktiv |
| 10:45 | Wegfinder ausbilden | 2 Holz/2 Stein reserviert; Ausbildung läuft |
| 11:30–15:00 | Zweiten Straßenarm ausbauen | Steinroute sichtbar, Wegfinder-Aufgabe verständlich vorbereitet |

Bei einer Fertigstellung auf einem Welttakt gilt immer: **erst Bau abschließen, danach Produktion gutschreiben**.

## Vier verbindliche Screens

### 1. START

- MERGEFORGE-Wortmarke, eigenes Dorf im Nebel, eine primäre Start-/Fortsetzen-Aktion
- GitHub-Identität nur als kompakter Accountindikator
- keine Serverliste, Newswand oder Shop im MVP

### 2. KARTE

- Karte ist die Hauptoberfläche; Pan und Zoom, Dorf, Fog und zusammenhängende Straßen
- obere Leiste zeigt nur Holz und Stein
- Kapitelziel bleibt als kompakte Fortschrittsleiste sichtbar
- fremde Spieler sind vor Kapitel 7 unsichtbar

### 3. BAUEN

- sichtbares angrenzendes Hex wählen, mögliche Straße als Vorschau sehen
- Kosten und Aufdeckungseffekt werden vor Bestätigung gezeigt
- wenige große, touch-taugliche Aktionen; kein mehrstufiges Untermenü

### 4. WEGFINDER

- Einheit bewegt sich kostenlos auf dem eigenen Straßennetz
- am Straßenkopf ist genau ein angrenzendes Nebelfeld untersuchbar
- am Relais öffnet sich das Signalwerk als isoliertes Minispiel-Overlay

Visuelle Referenz: `concept-art/phase-4/09-playable-blueprint-four-screens.png`.

## Abnahme der sieben Kapitel

| Kapitel | Messbarer Abschluss | Verbotener Nebeneffekt |
|---|---|---|
| 1 Gründungsring | exakt zwei verbundene Straßen für je 1 Holz | Straße auf unsichtbarem/unbegehbarem Hex |
| 2 Waldlinie | Wald in 3–4 Straßenfeldern verbunden; Holzlager produziert 2 Holz/Puls | Produktion ohne Straßenanschluss |
| 3 Steinlinie | Wegfinder untersucht ein Nebelfeld; Steinbruch produziert 1 Stein/Puls | Wegfinder beansprucht Land oder überspringt Hexes |
| 4 Weggabel | acht verbundene Straßen; Vermesserzelt erhöht Ladungsspeicher 6→12 | automatische Aufdeckung ganzer Regionen |
| 5 Totes Signal | Relais nach 8–12 möglichen Straßenfeldern entdeckt | Kontakt oder Sicht auf fremde Siedlung |
| 6 Resonanzkern | Signalwerk einmalig gelöst; genau ein Kern dauerhaft installiert | Kern farmbar, handelbar oder verlierbar |
| 7 Erstes Signal | Richtung und grobe Entfernung zu zwei Nachbarn sichtbar | fremde Karte, Handel oder fertige Verbindung |

## Abnahme-Gate vor Code

Die Umsetzung darf beginnen, wenn Projektowner und Projektmaster diese Punkte ausdrücklich freigeben:

- Vier Screens und 15-Minuten-Ablauf bilden dasselbe Spiel.
- Welt-, Ressourcen- und Timerwerte sind widerspruchsfrei.
- M0-Issues sind präzise genug für getrennte Agentenpakete.
- Nicht-Ziele bleiben außerhalb der ersten Vertikalscheibe.

