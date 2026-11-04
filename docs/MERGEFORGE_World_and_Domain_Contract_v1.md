# MERGEFORGE — Welt- und Domänenvertrag v1

**Status:** stackneutrale MVP-Spezifikation, zur Abnahme

## Determinismus

Eine Welt wird durch `world_seed`, `generator_version` und `world_epoch` bestimmt. Gleiche Werte erzeugen identische Hexes, Gelände, Startzonen, Funde, Relais und Signalwerk-Rätsel.

Zufall verwendet getrennte benannte Seed-Bereiche: `terrain`, `spawn_slots`, `surface_finds`, `relays`, `signalwerk`. Eine Änderung am Minispiel darf daher niemals die Karte verändern. Bestehende Welten behalten dauerhaft ihre Generatorversion.

Die Karte verwendet axiale Hexkoordinaten `(q, r)` und eine fest dokumentierte Reihenfolge der sechs Nachbarn.

## Startzonen-Invarianten

| Regel | Wert |
|---|---:|
| Gründungsradius | 5 Hexes |
| Abstand nächstes Dorf | 18–24 begehbare Straßenfelder |
| Anfangssicht | Dorf + 6 Nachbarn |
| Relaisentfernung | 8–12 begehbare Straßenfelder |
| Garantierte Funde | mindestens 6 Holz, 4 Stein |
| Startbestand | 12 Holz, 6 Stein |
| Garantierte Standorte | mindestens 1 Wald und 1 Stein |

Startzonen überlappen nicht. Wald, Stein und Relais müssen erreichbar sein. Das Relais liegt außerhalb der Anfangssicht. Ungültige Startzonen werden verworfen, nicht durch Sonderbelohnungen repariert.

## Straßen und Sicht

Eine Straße ist nur gültig, wenn das Ziel sichtbar, begehbar, straßenfrei, an das mit dem Dorf verbundene Netz angrenzend und 1 Holz vorhanden ist. Kosten und Bau werden atomar verbucht.

- Sicht bleibt persistent.
- Eine Straße deckt Zielhex und direkte Nachbarn auf.
- Sicht erzeugt weder Besitz noch Anschluss.
- Ein Rohstoffgebäude benötigt die direkte Verbindung zum Dorfstraßennetz.
- Der Wegfinder deckt für 1 Ladung genau ein unbekanntes Nachbarhex am Straßenkopf auf.

## Weltpuls und Bauaufträge

```text
pulse_index = floor((now - world_epoch) / 600 Sekunden)
```

Offline-Fortschritt wird aus Pulsdifferenzen berechnet, nicht clientabhängig simuliert. Ein Dorf besitzt höchstens einen zeitgebundenen Bauauftrag; Straßen belegen ihn nicht. Kosten werden beim Start reserviert, `completes_at` bestimmt die Fertigstellung. Wiederholte Anfragen dürfen nichts doppelt abbuchen oder belohnen.

## Minimales Datenmodell

```text
World(id, seed, generatorVersion, epoch)
Hex(worldId, q, r, terrainType, traversable, resourceSiteType?, relaySiteId?)
SpawnSlot(worldId, slotIndex, q, r, assignedPlayerId?)
Player(id, githubUserId, githubLogin)
Settlement(id, worldId, playerId, villageQ, villageR,
           wood, stone, lastSettledPulse, chapter)
RevealedHex(settlementId, q, r, revealedAt, revealMethod)
Road(settlementId, q, r, builtAt)
SurfaceFind(worldId, q, r, resourceType, amount, collectedAt?)
Building(id, settlementId, q, r, type, state, startedAt, completesAt)
Unit(id, settlementId, type, q, r, expeditionCharges, lastChargePulse)
PlayerProgress(settlementId, relayDiscovered, signalwerkSolved,
               resonanceCoreState, signalNetworkActive)
```

Eindeutigkeit verhindert doppelte Straßen/Gebäude, mehrfach gesammelte Funde, mehrere aktive Bauaufträge, mehr als einen Resonanzkern und doppelt verbuchte Produktionspulse.

## Technische Abnahme

1. Seed + Generatorversion erzeugen identische Inhalte.
2. Jede Startzone erfüllt alle Garantien und ist ohne Hilfe abschließbar.
3. Ungültige Straßen werden ohne Teilabbuchung abgelehnt.
4. Fog, Funde, Bau und Produktion sind nach Neuladen unverändert.
5. Offline- und Online-Zeiträume ergeben dasselbe Resultat.
6. Lagerkapazitäten werden nie überschritten.
7. Kern und Minispielbelohnung sind exakt einmalig.
8. Neue Generatorversionen verändern keine bestehende Welt.

