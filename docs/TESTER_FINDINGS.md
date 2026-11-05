# Tester-Funde

Laufendes Log der ehrlichen Spieltests. Der KI-Tester ist `.claude/agents/tester.md` (Rolle „Mia“, spielt im lokalen Sandbox-Modus). Jeder Lauf hängt unten einen Abschnitt an. Behobene Funde bleiben stehen und werden mit dem PR markiert.

**Was die KI nicht prüft:** Online-Speicher, Funkkontakte, Handel (Login nötig) und ob das Spiel Spaß macht. Das bleibt bei echten Menschen.

**Status-Legende:** offen · behoben (PR) · verworfen (Begründung)

---

## Lauf 1 · 2026-11-05 · Mia (Sandbox, Desktop und 390 px)

**Gesamteindruck:** Die ersten zehn Minuten sind klar. Straßen, Holzfällerlager, Steinbruch, Bau-Timer und Speichern funktionieren. In Kapitel 3 ("Ein Nebelhex vermessen") blieb Mia nach etwa 8 Minuten hängen und hätte geschlossen. Wärst du drangeblieben: **Vielleicht.**

**Geprüft und in Ordnung:** Doppelklick auf "Straße bauen" kostet nur 1 Holz. Neuladen mitten im Bau behält Spielstand und Restzeit. Der Bauplatz-Sperrgrund während eines Baus wird erklärt. "Feld wählen" markiert passende Felder.

**Nicht geprüft (wegen Blocker):** Vermessung selbst, Vermesserzelt, Kapitel 4 bis 7, Signalwerk, Relais, Handelsposten, Harzsammler.

| # | Schwere | Fund | Status |
|---|---|---|---|
| 1 | Blocker | Vermessung nicht auffindbar. Nach dem Ausbilden bleibt das Ziel "Vermessen 0/1" stehen, Klicks auf Nebelfelder tun nichts, kein Hinweis. **Ursache (vom Projektleiter geprüft):** Der Wegfinder muss erst auf einen Straßenkopf gezogen werden, erst dann ist ein Nebelfeld vermessbar. Das sagt dem Spieler nirgends jemand, der Satz "Vermessungen beginnen an einem Straßenkopf" steht nur in der Fehlermeldung. Die Wegfinder-Karte im Baumenü hat nach "Ausgebildet" keine Aktion. | behoben (fix/tester-run1): Hinweisbox im Kapitelfenster mit Schritt 1 und 2, "Felder markieren", Hinweis auch auf der Wegfinder-Karte |
| 2 | Hoch | Gesperrte Baukarten nennen den Grund nicht ("Wald-Feld mit Straße" liest sich wie eine Beschreibung). Nach dem Bau eines Holzfällers ist die Karte wieder grau ohne Hinweis. Wald ist nur an winzigen Symbolen erkennbar. | behoben (fix/tester-run1): Karten sagen "Noch kein Wald in Sicht: erkunde weiter" oder "Zuerst eine Straße bis zu einem Wald-Feld bauen" |
| 3 | Mittel | Startansicht: winziges Cluster im riesigen Nebel, Symbole sehr klein. Zoom-Hinweis nur klein unten rechts. | behoben (fix/tester-run2): Startzoom |
| 4 | Mittel | 390 px: Kopfleiste läuft rechts aus dem Bild, Kapitel-Badge nicht sichtbar. "Bauen"-Knopf überdeckt die Sektoranzeige. Offenes Menü lässt nur schmalen Kartenstreifen. | offen |
| 5 | Mittel | Baumenü zeigt ab Kapitel 2 zehn Karten mit unerklärten Begriffen (Resonanzkern, Takt, Ladungen, Nebelhex, Online-Konto). Leiste horizontal scrollbar. Spätere Karten sollten ausgeblendet oder erklärt sein. | teilweise behoben: Karten der Relaiskette erscheinen erst nach Kapitel 4, Legende "1 Takt = 10 Minuten". Begriffe wie Ladungen bleiben unerklärt |
| 6 | Niedrig | "Feld: forest mit Straße" auf der Harzsammler-Karte (englisches Wort). | behoben (fix/tester-run1) |
| 7 | Niedrig | Waldfeld zeigt zwei Bau-Panels (Holzfällerlager und Harzsammler), das Kapitelziel ist nicht hervorgehoben. | offen |
| 8 | Niedrig | Panel "Steinbruch – Produktion aktiv" mit starrem Timer 10:00 bleibt stehen. Klick auf Feld mit Straße zeigt "Straße planen" mit grauem Knopf. | offen |

---

## Lauf 2 · 2026-11-05 · Mia (Sandbox)

**Gesamteindruck:** Der Hinweistext allein reichte nicht. Kapitel 3 blieb unlösbar, obwohl er jetzt dasteht.

| # | Schwere | Fund | Status |
|---|---|---|---|
| 9 | Blocker | Das Straßenende ist oft ein Wald- oder Steinfeld. Ein Klick darauf zeigte nur Baukarten, die Karte "Wegfinder bewegen" blieb unsichtbar. Karten lagen außerdem übereinander. | behoben (fix/tester-run2): Wegfinder-Karte erscheint auch auf Baufeldern, alle Karten in einem gemeinsamen Stapel, Straßenenden werden automatisch markiert (im Browser geprüft) |
| 10 | Mittel | Kartentitel und Hinweis widersprachen sich ("am Straßenkopf", obwohl er es nicht war). | behoben (fix/tester-run2): Titel und Text kommen aus derselben Quelle |
| 11 | Mittel | Startansicht winzig. | behoben (fix/tester-run2): Mindestmaßstab 0,95 beim Start |
| 12 | Niedrig | Hinweis bei bereits bebautem Waldfeld war missverständlich. | behoben (fix/tester-run2) |

---

## Lauf 3 · 2026-11-05 · Mia (Sandbox)

**Gesamteindruck:** Kapitel 1 und 2 laufen glatt. In Kapitel 3 blieb Mia wieder hängen. Wärst du drangeblieben: **Vielleicht.**

| # | Schwere | Fund | Status |
|---|---|---|---|
| 13 | Blocker | Nebelfelder ließen sich nicht anklicken und "Felder markieren" zeigte nichts. **Ursache (vom Projektleiter geprüft):** Der Renderer ignorierte Klicks auf Nebelfelder komplett, und Markierungen wurden nur auf sichtbaren Feldern gezeichnet. Die Vermessung war damit nie auslösbar. | behoben (fix/tester-run3): Nebelfelder wählbar und markierbar, Vermessung bis Kapitel 4 im Browser durchgespielt |
| 14 | Hoch | Straßenende mit Gebäude (Steinbruch) zeigt nur das Gebäude-Panel, kein "Wegfinder bewegen". | behoben (fix/tester-run3) |
| 15 | Mittel | Hinweistext zeitweise veraltet, Doppelklick auf "Zelt errichten" löst Folgeaktion aus (Wegfinder springt ins Dorf). | offen |
| 16 | Mittel | 390 px: Leiste läuft aus dem Bild, Kapitelkarte verdeckt Karte. Baumenü verdeckt halbe Karte, Vorspulknopf wandert. | behoben (fix/mobile-layout): kompakte Leiste, kurze Kapitelkarte, Bauen-Knopf rechts unten, Menü max. halbe Höhe (im Browser bei 390 px geprüft) |
| 17 | Niedrig | Koordinatentexte ("Wegfinder nach 4, 0"), Steinbruch-Karte "erkunde weiter" obwohl Kapitel ihn verlangt, kein Bau-Fortschritt auf der Karte, "Bauplatz belegt" missverständlich. | offen |
