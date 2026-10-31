# MERGEFORGE — Projektbibel und Agenten-Übergabe

**Dokumenttyp:** Source of Truth für spätere Contributors und spezialisierte Agenten  
**Stand:** M1-Vertikalscheibe und M2-Weltziele umgesetzt; Issue #10 Steinloop auf `feature/m2-2-stone-loop` in Abnahme (31. Oktober 2026)

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
- App-Implementierung: Design-Lock freigegeben; Start ausschließlich über abgenommene M1-Issues
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

## Aktueller Implementierungsstand

- **M1.1:** deterministische Hexwelt, Dorf, Fog of War sowie Pan/Zoom umgesetzt
- **M1.2:** zusammenhängender Straßenbau, Kosten, Aufdeckung und Kapitelziel umgesetzt
- **M1.3:** einmalige Wald-Oberflächenfunde, Holzfällerlager, 10-Minuten-Welttakt, Offline-Nachholung und versionierter lokaler Spielstand umgesetzt
- **M2.1 / Issue #9:** garantierte, erreichbare Steinquelle und deterministische Relaisplatzierung als Weltziele umgesetzt
- **M2.2 / Issue #10:** datengetriebene Steinfunde, Steinbruch, generische Gebäude-/Funddarstellung und persistente Steinproduktion umgesetzt; Abnahme läuft
- Der Spielzustand ist über `GameState` versioniert. Die Welt wird aus Seed, Generatorversion und Radius reproduzierbar regeneriert; gespeichert werden nur Spielzustand und Fortschritt.
- Beschädigte oder inkompatible lokale Spielstände führen kontrolliert zu einem neuen Start statt zu einem Absturz.
- **Aktueller Arbeitsbranch:** `feature/m2-2-stone-loop`
- **Aktuelles Issue:** #10 — Steinfunde, Steinbruch und persistente Steinproduktion

## Verbindliche M2-Issue-Reihenfolge

Die vier M2-Issues werden nacheinander über `feature/* → dev` integriert. Jedes Issue bleibt einzeln test- und abnehmbar; spätere Mechaniken dürfen nicht vorgezogen werden.

| Issue | Branch | Ziel | Abhängigkeit |
|---:|---|---|---|
| **#9 — Weltziele** | `feature/m2-1-world-objectives` | Garantierte, erreichbare Steinquelle in der Gründungszone und deterministisches Relais außerhalb der Anfangssicht in 8–12 begehbaren Schritten | M1.3 |
| **#10 — Steinloop** | `feature/m2-2-stone-loop` | Einmalige Steinfunde, verbundener Steinbruch, 10-Minuten-Bauzeit und 1 Stein je Welttakt mit Offline-Nachholung | #9 |
| **#11 — Wegfinder** | `feature/m2-3-pathfinder-survey` | Ausbildung, Straßenbewegung, Expeditionsladungen, Vermessung genau eines Nebelhexes und Vermesserzelt | #10 |
| **#12 — Relais-Prolog** | `feature/m2-4-relay-prologue` | Kapitel 3–5 automatisch und einmalig abschließen; verborgenes Relais durch Straße oder Wegfinder entdecken | #9, #10 und #11 |

### Issue #9 — Abnahmegrenze

Issue #9 liefert ausschließlich die deterministische Weltgrundlage für die nachfolgenden Systeme:

- Gleicher Seed und gleiche Generatorversion erzeugen dieselbe Steinquelle und dasselbe Relais.
- Mindestens eine Steinquelle ist innerhalb der Gründungszone über begehbare Hexfelder erreichbar.
- Das Relais liegt außerhalb der Anfangssicht und 8–12 begehbare Schritte vom Dorf entfernt.
- Ungültige Startzonen werden deterministisch verworfen; fehlende Garantien werden nicht durch Bonusressourcen kaschiert.
- Steinquelle und Relais besitzen stabile, serialisierbare Kennungen und automatisierte Tests für Reproduzierbarkeit, Erreichbarkeit und Distanz.

**Nicht-Ziele von Issue #9:**

- keine Steinfunde, Steinbruchkosten, Bauaufträge oder Steinproduktion
- kein Wegfinder, keine Bewegung, Expeditionsladungen oder Vermessungsaktion
- keine Kapitelabschlüsse oder Questbelohnungen
- keine Relaisinteraktion, Reparatur oder Freischaltung des Signalwerks
- kein Resonanzkern, Signalnetz oder Hinweis auf andere Spieler
- keine Multiplayer-, Backend- oder Accountlogik
- keine neue allgemeine Ressourcen- oder Gebäude-UI; #9 stellt nur die Welt- und Domänendaten bereit

### Issue #10 — Abnahmegrenze

Issue #10 macht Stein als zweite Ressource erstmals vollständig spielbar:

- Explizite, datengetriebene Oberflächenfunde liefern in Summe 4 Stein und werden beim Aufdecken durch verbundenen Straßenbau genau einmal eingesammelt.
- `claimedSurfaceFindTileKeys` bleibt die persistierte Historie aller bereits geborgenen Wald- und Steinfunde, auch bei vollem Lager.
- Ein Steinbruch kann nur auf einem ausgewiesenen, per Straße verbundenen Steinvorkommen entstehen.
- Der Steinbruch kostet 3 Holz und 1 Stein, benötigt 10 Minuten Bauzeit und produziert danach 1 Stein je 10-Minuten-Welttakt.
- Offline-Nachholung und Lagergrenzen gelten einheitlich: maximal 300 Holz und 150 Stein; verstrichene Takte werden auch bei vollem Lager verbraucht.
- Renderer und Weboberfläche verwenden generische Gebäude- und Fundmodelle für Holz und Stein statt ressourcenspezifischer Sonderpfade.
- Der lokale Spielstand akzeptiert Steinbrüche nur auf weiterhin gültigen Steinquellen und verwirft manipulierte oder strukturell ungültige Daten kontrolliert.
- Nach Beauftragung des Holzfällerlagers weist die Kapitelanzeige in Richtung Steinlinie; der vollständige Prolog-Kapitelabschluss bleibt Issue #12 vorbehalten.

**Nicht-Ziele von Issue #10:**

- kein Wegfinder, keine Expeditionsladungen, Bewegung oder Vermessungsaktion
- kein Vermesserzelt und keine zusätzliche Aufdeckungsmechanik
- keine Relaisinteraktion, Reparatur oder Aktivierung des Signalwerks
- kein Resonanzkern, Signalnetz oder Spielerkontakt
- keine Multiplayer-, Backend- oder Accountlogik
- kein vollständiger Kapitel-3-Abschluss mit einmaligen Questbelohnungen; dieser wird in Issue #12 orchestriert

## Noch offene Produktentscheidungen

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
