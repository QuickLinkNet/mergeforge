# MERGEFORGE — Projektbibel und Agenten-Übergabe

**Dokumenttyp:** Source of Truth für spätere Contributors und spezialisierte Agenten  
**Stand:** Spielbare Blaupause v1 erstellt, Umsetzung noch nicht freigegeben

## Vision

MERGEFORGE ist eine persistente, prozedurale Browser-Hexwelt. Jeder Spieler gründet ein Dorf, erkundet entlang selbst gebauter Straßen und erschließt ein zunächst kleines, aber vollständig spielbares System. Neue Gebäude, Einheiten, Ressourcen, Automatisierung, PvE/PvP, Events, Minispiele und UI-Module entstehen später durch geprüfte Pull Requests.

Der Code ist nicht nur Technik hinter dem Spiel: Genehmigte Erweiterungen werden als neue Möglichkeiten in derselben lebenden Welt erfahrbar.

## Bestätigte Entscheidungen

- Name: **MERGEFORGE**
- Grafik: **Stil A — Diorama Lite**
- Plattform: Desktop-/Tablet-taugliches Browsergame, Touch mitgedacht
- Karte: persistente prozedurale Hexwelt
- Start: kleines Dorf mit großem Abstand zu anderen Spielern
- Hauptsprache der Expansion: zusammenhängende Straßen
- Nebel: wird entlang von Straße und Wegfinder schrittweise aufgedeckt
- MVP-Ressourcen: Holz und Stein
- Zeitmodell: sofortige aktive Aktionen + 10-Minuten-Welttakt
- Offline-Produktion: ja, bis Lager voll
- Prolog: sieben Zielkapitel, keine sieben Kalendertage
- Erste Einheit: Wegfinder
- Erstes Minispiel: Signalwerk
- Minispiel-Belohnung: einzigartiger Resonanzkern
- Kontakt zu anderen Spielern: zunächst nur Richtungsimpuls, kein früher Sicht-/Reisezugang
- Monetarisierungs-/Login-Zwang: nicht Teil des MVP
- App-Implementierung: ausdrücklich erst nach Freigabe des Pitches
- Spieleridentität: interne MERGEFORGE-ID, im MVP mit stabiler numerischer GitHub-ID verknüpft
- Lizenz: MIT
- Branchmodell: `feature/* → dev → main`; `main` enthält nur stabile Versionen

## Dokument-Hierarchie

Bei Widersprüchen gilt folgende Reihenfolge:

1. Neueste ausdrücklich bestätigte Entscheidung des Nutzers
2. Dieses Dokument
3. `MERGEFORGE_Playable_Blueprint_v1.md`
4. `MERGEFORGE_World_and_Domain_Contract_v1.md`
5. `MERGEFORGE_Economy_Exploration_and_Time_Model.md`
6. `MERGEFORGE_MVP_Backlog_v1.md`
7. `MERGEFORGE_Visual_Styles_and_First_7_Days.md`
8. Ursprünglicher Game Pitch v1

Ältere Bilder sind Stil- oder Stimmungsreferenzen, aber nicht automatisch eine korrekte Darstellung der Kartenlogik.

## MVP-Erfolgskriterium

Eine neue Person kann ohne Anleitung das Dorf und den Nebel verstehen, eine Straße bauen, Holz und Stein erschließen, einen Wegfinder nutzen, ein Relais entdecken, das Signalwerk lösen sowie einen Resonanzkern einsetzen und ein entferntes Spielersignal empfangen.

Der Durchlauf ist damit vollwertig spielbar, auch wenn danach zunächst nur die persistente Sandbox bleibt.

## Erweiterungsvertrag für Pull Requests

Jedes Spielmodul muss deklarieren:

- eindeutige Modul-ID und Version
- benötigte Fähigkeiten/Abhängigkeiten
- bereitgestellte Fähigkeiten
- Datenmigration und Rückwärtskompatibilität
- Servervalidierung aller Belohnungen und Zustandsänderungen
- eigenes UI-Einstiegsfenster, ohne Kernnavigation zu überschreiben
- Tests für Kosten, Belohnungen und Seed-Reproduzierbarkeit
- Deaktivierungs-/Rollback-Verhalten
- keine Hardcodes, die ältere Welten unspielbar machen

Beispiel: Das Signalwerk benötigt `relay_discovered` und liefert `signal_network_active`.

## Empfohlene spätere Agentenpakete

Erst nach Umsetzungsfreigabe können die Arbeiten getrennt vergeben werden:

| Paket | Ergebnis | Abhängigkeit |
|---|---|---|
| Welt & Seeds | reproduzierbare Hexkarte, Startzonen, Garantien | freigegebene Zahlenwerte |
| Karten-UI | Pan/Zoom, Hexauswahl, Fog, Straßen-Vorschau | Weltmodell |
| Wirtschaft | Welttakt, Lager, Kosten, Offline-Fortschritt | Serverzustand |
| Wegfinder | Bewegung, Ladungen, Aufdecken | Karte + Zeitmodell |
| Bauen | Bauplatz, Timer, Produktionsgebäude | Wirtschaft |
| Signalwerk | isoliertes seedbasiertes Minispiel | Modulvertrag |
| Relais-Prolog | Kapitelziele, Kern, Signalabschluss | alle MVP-Systeme |
| Contribution-System | Modulmanifest, Prüfungen, CI/Build/Deploy | stabile MVP-Schnittstellen |
| Art Pipeline | Stil-A-Assets, Größenraster, Varianten | bestätigtes UI-Raster |

Kein Agent soll die Kernregeln nebenbei neu erfinden. Änderungen an bestätigten Werten werden als kurze Entscheidungsnotiz dokumentiert.

## Offene Entscheidungen vor Implementierung

- endgültiger Projektname/Logo beibehalten oder ändern
- genaue Zielplattformen und kleinste unterstützte Bildschirmbreite
- Einzelserver-Welt oder mehrere Weltinstanzen
- persistente Echtzeit-Mehrspieleranzeige oder zunächst asynchroner Nachbarzustand
- Hosting, Datenbank und Deployment-Ziel
- endgültige UI-Komposition von Stil A
- ob der erste Prolog lokal/single-player simulierbar sein soll

## Verbotene Abkürzungen in der MVP-Planung

- Dörfer nicht direkt nebeneinander platzieren, nur damit Multiplayer früher sichtbar ist.
- Kein täglicher Login als Ersatz für sinnvolle Spielaktionen.
- Keine zusätzlichen Ressourcen ohne eine neue spielerische Entscheidung.
- Keine langen Timer, wenn währenddessen nichts anderes möglich ist.
- Der Resonanzkern darf keine generische Farmwährung werden.
- Ein PR darf bestehende Weltstände nicht stillschweigend ungültig machen.

## Aktuelle visuelle Wahrheit

Die gültige Darstellung der sieben Kapitel ist `concept-art/phase-3/08-first-seven-days-continuous-map.png`: eine zusammenhängende Karte mit Dorf im eigenen Startsektor, Straßenästen zu Wald, Stein und Relais, Wegfinder am Straßenkopf, großen Nebelflächen, entfernten Spielern als Lichtpunkten und einem Signal statt einer frühen physischen Verbindung.

Die gültige UI-Komposition für die spielbare Blaupause ist `concept-art/phase-4/09-playable-blueprint-four-screens.png` mit START, KARTE, BAUEN und WEGFINDER/Signalwerk.
