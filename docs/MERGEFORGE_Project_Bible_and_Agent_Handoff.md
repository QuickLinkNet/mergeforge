# MERGEFORGE — Projektbibel und Agenten-Übergabe

**Dokumenttyp:** Source of Truth für spätere Contributors und spezialisierte Agenten  
**Stand:** M1, M2 und M3.1–M3.2 umgesetzt; M3.3 Kapitel 7 (erstes Signal) auf `feature/m3-3-signal-impulse` in Abnahme (2. November 2026)

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
- **M2.2 / Issue #10:** datengetriebene Steinfunde, Steinbruch, generische Gebäude-/Funddarstellung und persistente Steinproduktion umgesetzt
- **M2.3 / Issue #11:** Wegfinder-Ausbildung, Straßenbewegung, Expeditionsladungen, Einzelhex-Vermessung und Vermesserzelt umgesetzt
- **M2.4 / Issue #12:** Kapitel 3–5, persistente Prolog-Meilensteine und einmalige Relaisentdeckung umgesetzt und in `dev` integriert
- **M3.1 / Issue #17:** deterministisches Signalwerk, isoliertes 5×5-Minispiel, einmalige Lösung und einzigartiger uninstallierter Resonanzkern umgesetzt und in `dev` integriert
- **M3.2 / Issue #19:** Relaiswerkstatt, Kerninstallation, 30-minütige Relaisreparatur und einmaliger Abschluss von Kapitel 6 umgesetzt und in `dev` integriert
- **M3.3 / Kapitel 7:** zwei deterministische Fernsignale (grobe Richtung und Entfernung), Relaisfähigkeit `signal_network_active` und Kapitel 7 durch die Aktion „Fernsignal scannen“ umgesetzt und in `dev` integriert (Spielstand-Schema 6, Schema 5 wird migriert)
- **Modulgrundlage:** JSON-Manifestvertrag und Harzsammler-Entwurf dokumentiert; der reine Manifest-Validator ist in `dev`. PR 24 ergänzt Schema 7 und die unveränderte Sperre für fehlende Module und befindet sich in Abnahme.
- Der Spielzustand ist über `GameState` versioniert. Die Welt wird aus Seed, Generatorversion und Radius reproduzierbar regeneriert; gespeichert werden nur Spielzustand und Fortschritt.
- Beschädigte oder inkompatible lokale Spielstände führen kontrolliert zu einem neuen Start statt zu einem Absturz.
- **Aktueller Integrationsstand:** `dev` bei `48b08b9`; PR 21–23 sind gemerged.
- **Aktuelle Aufgabe:** Datengetriebene Modulgrundlage abschließen; zuerst PR 24 prüfen, danach Lader/Kernmechanismus und Harzsammler-Daten als getrennte PRs.

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

### Issue #11 — Abnahmegrenze

Issue #11 führt die erste bewegliche Einheit und eine gezielte Alternative zur Straßenaufdeckung ein:

- Der Wegfinder wird am Dorf für 2 Holz und 2 Stein in 10 Minuten ausgebildet.
- Nach Abschluss bewegt er sich sofort und kostenlos zwischen Dorf und Feldern des verbundenen Straßennetzes.
- Am Straßenkopf kann er für genau 1 Expeditionsladung exakt ein unbekanntes Hex in axialer Distanz 2 vermessen. Die Reichweite berücksichtigt, dass die Straße ihre direkten Nachbarn bereits aufdeckt.
- Expeditionsladungen entstehen im 10-Minuten-Welttakt, werden offline nachgeholt und besitzen zunächst ein Maximum von 6.
- Das Vermesserzelt kostet 3 Holz und 1 Stein, benötigt 10 Minuten Bauzeit und erhöht den Ladungsspeicher dauerhaft auf 12.
- Wegfinderstatus, Position, Ladungen und Vermesserzelt sind Teil des validierten lokalen Spielstands.
- Die Kartenoberfläche zeigt Ausbildung, Ladungsstand, gültige Straßenbewegung, ein einzelnes Vermessungsziel und Zeltbau mit touch-tauglichen Aktionen.
- Die Kapitelanzeige bereitet innerhalb der Steinlinie den Wegfinder als sichtbares Zwischenziel vor; automatische, einmalige Kapitelabschlüsse bleiben Issue #12 vorbehalten.

**Nicht-Ziele von Issue #11:**

- keine freie Bewegung außerhalb von Dorf und verbundenem Straßennetz
- keine Aufdeckung mehrerer Hexfelder pro Vermessungsaktion
- kein Besitz, Straßenanschluss oder automatischer Ressourcenabbau durch bloße Vermessung
- keine Relaisinteraktion, Reparatur oder Aktivierung des Signalwerks
- keine Kapitelbelohnungen, Werkstatt, Resonanzkern oder Spielerkontakte
- keine Kampf-, Verlust-, Ausrüstungs- oder weitere Einheitentypen

### Issue #12 — Abnahmegrenze

Issue #12 schließt M2 mit einem strikt sequenziellen, persistenten Prolog ab:

- Die Oberfläche zeigt immer nur das aktuell erreichbare Kapitelziel; zukünftige Kapitel und Mechaniken werden nicht vorweggenommen.
- Kapitel 3 endet erst nach beobachteter erster Steinproduktion und mindestens einer erfolgreichen Wegfinder-Vermessung.
- Kapitel 4 endet erst mit mindestens acht verbundenen Straßenfeldern und einem aktiven Vermesserzelt.
- Kapitel 5 endet, sobald das Relais-Hex durch Straßenbau oder Wegfinder-Vermessung sichtbar wird.
- Jedes Ziel besitzt einen messbaren Fortschritt; bei kombinierten Zielen zeigt die UI zunächst den noch offenen Teilschritt.
- Kapitelabschlüsse und `relay_discovered` werden als geordnete, eindeutige Prolog-Meilensteine im Spielstand gespeichert.
- Laden und erneutes Speichern duplizieren weder Kapitelabschlüsse noch Relaisereignisse oder Belohnungen.
- Das entdeckte Relais erhält einen sichtbaren Kartenhinweis, bleibt vor seiner Entdeckung aber vollständig im Fog of War.
- Nach Kapitel 5 benennt die UI den M2-Prolog als abgeschlossen und verweist lediglich auf M3, ohne dessen Systeme vorzutäuschen.

**Nicht-Ziele von Issue #12:**

- kein Signalwerk-Minispiel und keine Minispielbelohnung
- kein Resonanzkern, keine Werkstatt und keine Relaisreparatur
- keine Aktivierung des Relais oder Signalnetzes
- kein Richtungsimpuls, Spielersignal oder Kontakt zu anderen Siedlungen
- keine neue Ressource, Kampfeinheit, PvE- oder PvP-Mechanik

### Issue #17 — Abnahmegrenze

Issue #17 eröffnet Kapitel 6 als ersten isolierten Minispiel-Slot:

- Das Signalwerk ist erst nach abgeschlossenem Kapitel 5 und `relay_discovered` erreichbar.
- Ein eigenständiges Pure-TS-Paket erzeugt aus Welt-Seed und Relaisposition ein deterministisches, garantiert lösbares 5×5-Rotationspuzzle.
- Maus- und Touch-Eingaben drehen genau eine Runenplatte um 90 Grad; die Domain validiert den vollständigen Energiepfad unabhängig von der UI.
- Plattenrotationen werden nach jeder Aktion gespeichert und bleiben beim Schließen oder Reload erhalten.
- Die erste gültige Lösung setzt `signalwerk_solved` genau einmal und vergibt exakt einen einzigartigen, noch nicht installierten Resonanzkern.
- Der Kern ist keine Ressource oder Währung: Er kann in diesem Issue weder verbraucht, gehandelt, verloren noch erneut gewonnen werden.
- Das Overlay besitzt keinen Zeitdruck und keinen Zustand mit Ressourcenverlust.

**Nicht-Ziele von Issue #17:**

- keine Werkstatt und keine Relaisreparatur
- keine Installation oder Aktivierung des Resonanzkerns
- kein Signalnetz, Richtungsimpuls oder Kontakt zu fremden Sektoren
- noch kein allgemeines Contributor-Modulmanifest; das isolierte Paket liefert nur die erste belastbare Schnittstelle

### Issue #19 — Abnahmegrenze

- Nach gelöstem Signalwerk kann am Dorf für 6 Holz und 4 Stein eine Relaiswerkstatt mit 20 Minuten Bauzeit errichtet werden.
- Erst die aktive Werkstatt erlaubt am entdeckten Relais die einmalige Reparatur für 5 Holz, 6 Stein und den Resonanzkern.
- Der Kern wechselt atomar aus dem Inventar in das Relais und bleibt dort als installierter Questgegenstand sichtbar.
- Die Reparatur dauert 30 Minuten, wird offline nachberechnet und schließt Kapitel 6 genau einmal ab.
- Werkstatt, Kerninstallation, Reparaturstatus und Kapitelereignis sind Teil des validierten Spielstands.

**Nicht-Ziele von Issue #19:** kein Richtungsimpuls, keine fremden Sektoren, kein datengetriebenes Modul und keine Online-Persistenz.

### M3.3 — Kapitel 7: Abnahmegrenze

- Kapitel 6 endet mit der abgeschlossenen Relaisreparatur. Kapitel 7 schließt **nicht** automatisch ab, sondern erst durch die explizite Spieleraktion „Fernsignal scannen“ (`scanFarSignals`, kostenlos und sofort). Sie ist nur bei aktivem Relais nach Kapitel 6 möglich und wirkt genau einmal; ein zweiter Scan wird mit `already-scanned` abgelehnt (Owner-/Codex-Entscheidung 7 B).
- Der Scan ist ein atomarer Schritt: Das Relais erhält intern die Fähigkeit `signal_network_active` (`relay.capabilities`), das Ereignis `first_signals_received` wird gespeichert und zwei Fernsignale entstehen.
- Die Signale folgen aus Welt-Seed und Generatorversion (eigener Seed-Bereich `signals`, Modul `packages/domain/src/signals.ts`). Die zwei simulierten Nachbarn liegen 18–24 Straßenfelder entfernt, in verschiedenen Himmelsrichtungen (6 Hexrichtungen, mindestens 2 Sektoren Abstand).
- Gespeichert und angezeigt werden ausschließlich Richtung (`bearing`) und Distanzband (`near` 18–20, `middle` 21–22, `far` 23–24). Exakte Distanz, Koordinaten, Gelände oder Karten fremder Sektoren existieren weder im Spielstand noch in der UI.
- Das Fernsignal-Panel erscheint im bestehenden Stil A und ist touch-tauglich (Zeilen ≥ 56 px). Vor dem Scan zeigt die Oberfläche nur die Aktion „Fernsignal scannen“; die Signalliste erscheint erst nach Kapitel 7.
- **Schema 6:** `GameState` erhält `signals` und `relay.capabilities`; Kapitel-ID `7` und Ereignis `first_signals_received` kommen hinzu. Spielstände mit Schema 5 werden beim Laden migriert (kein Reset): Die Migration erteilt Kapitel 7 nie selbst: Ein Stand mit abgeschlossenem Kapitel 6 steht danach bereit zum Scan. Ältere Schemata bleiben `incompatible`.
- Die Persistenz validiert Signale streng gegen die neu erzeugten Werte; manipulierte, ergänzte (z. B. Koordinaten), fehlende oder ohne Kapitel 7 vorhandene Signale, fehlende/doppelte Fähigkeiten und inkonsistente Kapitel-/Ereignisfolgen führen kontrolliert zu einem neuen Start.
- Kosten, Timer und bestehende Mechaniken bleiben unverändert.

**Nicht-Ziele von M3.3:** keine echten Spieler, kein Login, kein Backend, keine Sicht auf fremde Dörfer oder Karten, kein Straßenbau zwischen Sektoren, kein PvP/Handel/Weltprojekt, kein Contributor-Modulmanifest.

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
