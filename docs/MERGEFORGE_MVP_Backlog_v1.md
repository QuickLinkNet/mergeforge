# MERGEFORGE — MVP-Backlog v1

**Regel:** M0 ist Dokumentation. M1–M4 bleiben bis zur ausdrücklichen Code-Freigabe gesperrt.

## M0 — Design-Lock

1. **15-Minuten-Ablauf bestätigen** — Kosten, Erträge, Bauzeiten und UI-Reaktionen eindeutig.
2. **Weltvertrag bestätigen** — Koordinaten, Seeds, Startgarantien, Fog und Straßen eindeutig.
3. **Erweiterungsvertrag v1 bestätigen** — stabile Typen, Versionierung und Verhalten unbekannter Module.

**Gate:** Projektowner gibt danach die Umsetzung ausdrücklich frei.

## M1 — Frühe Vertikalscheibe

4. **Browser-Grundgerüst und Kartenansicht** — lokale zusammenhängende Hexkarte, Pan/Zoom, Dorf, Stil A.
5. **Fog und Straßenbau** — sichtbare Nachbarn, 1 Holz Kosten, deterministische Aufdeckung.
6. **Holzloop und lokaler Spielstand** — Fallholz, Holzlager, Neuladen erhält Zustand.

**Abnahme:** Ein neuer Spieler erreicht in höchstens 15 Minuten ein produzierendes Holzlager.

## M2 — Vollständiger Kernloop

7. **Stein, Bauaufträge, Weltpuls** — 10-Minuten-Puls und korrekte Zeitstempel-Nachberechnung.
8. **Wegfinder und Vermessung** — genau ein Nachbarhex am verbundenen Straßenkopf.
9. **Kapitel 1–5** — Ziele automatisch und einmalig; Relais wird gefunden.

## M3 — Signalwerk und Modultest

10. **Signalwerk** — seedbasiert, Maus/Touch, eindeutig lösbar und einmalig anerkannt.
11. **Resonanzkern und Kapitel 6–7** — Kern installieren; nur Richtung/Distanz fremder Sektoren.
12. **Erstes datengetriebenes Beispielmodul** — eine Erweiterung ohne Kerncodeänderung.

## M4 — Online- und Contributor-Grundlage

13. **GitHub-Login und interne Spieler-ID** — erneuter Login öffnet denselben Spielstand.
14. **Serverpersistenz und getrennte Startsektoren** — zwei Testspieler mit regelkonformen Sektoren.
15. **PR-Prüfung und Releaseweg** — Tests/Modulprüfung auf `dev`, Release-PR nach `main`.

## Arbeitsregel

```text
feature/<issue>-<name> → Pull Request nach dev
dev → abgenommener Release-Pull-Request nach main
```

Jedes Issue bleibt klein genug für einen Agenten und benötigt vor Merge eine funktionale Abnahme durch Projektmaster oder Owner.

