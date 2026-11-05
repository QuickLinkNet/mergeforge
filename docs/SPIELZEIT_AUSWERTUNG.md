# Spielzeit beim ersten Durchspielen (Stand 2026-11-05, Version nach Lauf 5)

**Methode:** Berechnet aus den Spielregeln im Code (Bauzeiten, Kosten, Einkommen, Bauplatz nur einer gleichzeitig) und aus den Tester-Läufen 1–5. Es gibt noch keine Messung mit echten Menschen. Die Zahlen sind eine begründete Schätzung, keine Messung.

## Kurzantwort

- **Eine Stunde reicht für den Prolog nicht.** Wer nur eine Stunde am Stück spielt, kommt ungefähr bis Kapitel 4 oder 5.
- **Kürzeste mögliche Dauer (Wanduhr):** etwa 1,5 bis 1,75 Stunden, weil allein die Pflichtbauten 90 Minuten Bauzeit haben, die man nicht überspringen kann.
- **Realistisch für eine Person, die zum ersten Mal spielt:** etwa 2 bis 2,5 Stunden Wanduhr, davon etwa 50 bis 75 Minuten aktiv am Bildschirm. Das passt zum Plan im Zeitmodell-Dokument (2 bis 4 Stunden für den Prolog).
- **Danach ist Schluss:** Mit Kapitel 7 (Fernsignal gescannt) endet der geführte Inhalt. Im Sandbox-Modus gibt es danach nichts mehr zu tun, online nur noch Funkkontakte und Handel.

## Pflicht-Wartezeiten (ein Bau gleichzeitig)

| Bau | Bauzeit | Kapitel |
|---|---:|---|
| Holzfällerlager | 10 Min | 2 |
| Steinbruch | 10 Min | 3 |
| Wegfinder ausbilden | 10 Min | 3 |
| Vermesserzelt | 10 Min | 4 |
| Relaiswerkstatt | 20 Min | 6 |
| Relais reparieren | 30 Min | 6 |
| **Summe** | **90 Min** | |

Der Wegfinder bekommt pro Takt (10 Min) eine Ladung und startet mit null. Das fällt zum Teil in die Bauzeit des Vermesserzelts und kostet im ungünstigen Fall bis zu 10 weitere Minuten.

## Rohstoffe

- Start: 12 Holz, 6 Stein. Dazu 4 Stein als Oberflächenfunde und 1 Holz pro neu aufgedecktem Waldfeld.
- Bedarf Gebäude: 23 Holz, 15 Stein. Dazu etwa 16 Straßenfelder (1 Holz je Feld) bis zum Relais.
- **Stein:** 10 ohne Steinbruch, 15 nötig. Der Steinbruch liefert 1 pro Takt und deckt das ab, wenn man ihn früh baut. Kein Engpass.
- **Holz:** Bedarf etwa 40 gegen etwa 36 bis 43 Einnahmen (Start, Waldfunde, 2 pro Takt aus dem Lager). Das ist knapp. Wer Straßen verschwendet, wartet ein paar Takte.

## Drei Spielertypen

| Typ | Aktiv am Bildschirm | Wanduhr bis Kapitel 7 | Hinweis |
|---|---:|---:|---|
| Rekord (alles sofort, kein Leerlauf) | ca. 35 Min | ca. 1:40 h | Setzt voraus, dass man den Ablauf schon kennt. |
| Erstspieler, liest und probiert | ca. 50 bis 75 Min | ca. 2:00 bis 2:30 h | Wahrscheinlichster Fall, in 2 bis 3 Sitzungen. |
| Gelegenheitsspieler, geht zwischen den Timern | ca. 60 bis 90 Min | 1 bis 3 Tage | Fortschritt läuft offline weiter. |

## Aktiv-Zeit nach Kapitel (Erstspieler)

| Kapitel | Inhalt | Aktiv | Wartezeit |
|---|---|---:|---:|
| 1 | 2 Straßen, erstes Verständnis | 5 bis 8 Min | 0 |
| 2 | Wald anbinden, Holzfällerlager | 3 bis 5 Min | 10 Min |
| 3 | Steinbruch, Wegfinder, erste Vermessung | 10 bis 15 Min | 20 Min |
| 4 | Straßennetz auf 8, Vermesserzelt | 5 bis 10 Min | 10 Min |
| 5 | Relais finden (ca. 10 Felder Richtung Südost, mit Hinweis) | 8 bis 15 Min | 0 |
| 6 | Signalwerk-Rätsel, Werkstatt, Reparatur | 8 bis 12 Min | 50 Min |
| 7 | Fernsignal scannen | 2 Min | 0 |

## Was das für den Start heißt

1. **Die erste Sitzung endet an einem Timer**, meist nach 45 bis 90 Minuten. Das ist der kritische Moment, in dem Spieler gehen oder wiederkommen. Es gibt noch keine Benachrichtigung und keinen Hinweis wie „Komm in 10 Minuten wieder“.
2. **Langweiliges Warten:** In den 90 Minuten Pflicht-Bauzeit gibt es wenig Sinnvolles zu tun außer Straßen und Funde. Ein Mittel dagegen wäre, Wartezeiten mit kleinen Aufgaben zu füllen (Funde, Erkundung) oder den Rückkehr-Grund klar zu nennen.
3. **Nach Kapitel 7 fehlt ein Ziel** im Sandbox-Modus. Wenn die Spielzeit 2 bis 3 Stunden sein soll, ist das gewollt; für „länger spielbar“ braucht es Kapitel 8 oder offene Ziele.

## Grenzen dieser Schätzung

- Keine Messung mit echten Menschen. Mia (KI-Tester) hat Kapitel 1 bis 7 in rund 8 Minuten durchgespielt, aber mit dem Entwickler-Knopf zum Vorspulen, das ist kein Maß für Menschen.
- Straßenanzahl und Holzbilanz hängen von der Weltzufallszahl ab (Relais liegt 8 bis 12 Felder entfernt).
- Es wurde angenommen, dass der Spieler Baufolge und Ziele richtig versteht. Verwirrung (siehe `TESTER_FINDINGS.md`) kann 10 bis 30 Minuten dazukommen.
