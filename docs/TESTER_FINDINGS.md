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
| 1 | Blocker | Vermessung nicht auffindbar. Nach dem Ausbilden bleibt das Ziel "Vermessen 0/1" stehen, Klicks auf Nebelfelder tun nichts, kein Hinweis. **Ursache (vom Projektleiter geprüft):** Der Wegfinder muss erst auf einen Straßenkopf gezogen werden, erst dann ist ein Nebelfeld vermessbar. Das sagt dem Spieler nirgends jemand, der Satz "Vermessungen beginnen an einem Straßenkopf" steht nur in der Fehlermeldung. Die Wegfinder-Karte im Baumenü hat nach "Ausgebildet" keine Aktion. | offen |
| 2 | Hoch | Gesperrte Baukarten nennen den Grund nicht ("Wald-Feld mit Straße" liest sich wie eine Beschreibung). Nach dem Bau eines Holzfällers ist die Karte wieder grau ohne Hinweis. Wald ist nur an winzigen Symbolen erkennbar. | offen |
| 3 | Mittel | Startansicht: winziges Cluster im riesigen Nebel, Symbole sehr klein. Zoom-Hinweis nur klein unten rechts. | offen |
| 4 | Mittel | 390 px: Kopfleiste läuft rechts aus dem Bild, Kapitel-Badge nicht sichtbar. "Bauen"-Knopf überdeckt die Sektoranzeige. Offenes Menü lässt nur schmalen Kartenstreifen. | offen |
| 5 | Mittel | Baumenü zeigt ab Kapitel 2 zehn Karten mit unerklärten Begriffen (Resonanzkern, Takt, Ladungen, Nebelhex, Online-Konto). Leiste horizontal scrollbar. Spätere Karten sollten ausgeblendet oder erklärt sein. | offen |
| 6 | Niedrig | "Feld: forest mit Straße" auf der Harzsammler-Karte (englisches Wort). | offen |
| 7 | Niedrig | Waldfeld zeigt zwei Bau-Panels (Holzfällerlager und Harzsammler), das Kapitelziel ist nicht hervorgehoben. | offen |
| 8 | Niedrig | Panel "Steinbruch – Produktion aktiv" mit starrem Timer 10:00 bleibt stehen. Klick auf Feld mit Straße zeigt "Straße planen" mit grauem Knopf. | offen |
