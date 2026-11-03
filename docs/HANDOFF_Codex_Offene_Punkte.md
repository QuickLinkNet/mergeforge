# MERGEFORGE — Codex-Handoff nach M3.3

Stand: 2026-11-03

## Verbindliche Antworten

1. **Nach M3.3:** Zuerst PR #21 prüfen und erst nach Korrektur/Abnahme mergen; danach das erste datengetriebene Beispielmodul, GitHub-Login mit interner Spieler-ID, Serverpersistenz mit getrennten Startsektoren und schließlich PR-/Release-Automation bis `main`.
2. **Git-Stand:** Der Haupt-Worktree auf `dev` sowie der M3.3-Worktree sind sauber und vollständig gepusht; lokales `dev` entspricht `origin/dev` bei `deca788`.
3. **Schema 5 → 6:** **A — migrieren.** D-011 wird inhaltlich akzeptiert; nur Schema 5 wird migriert, ältere Schemata bleiben inkompatibel.
4. **Fernsignalrichtungen:** **A — sechs Hexrichtungen**, passend zur axialen Hexwelt.
5. **Nächster Schritt:** Kein Kapitel 8; nach dem sieben Kapitel umfassenden Prolog folgt das erste datengetriebene Contributor-Beispielmodul ohne Kerncodeänderung.
6. **Zusätzliche Arbeitsregeln:** Conventional-Commit-Präfixe (`feat:`, `fix:`, `docs:`); kleine Feature-Branches; PR ausschließlich nach `dev`; kein automatisches Merge; vor Abnahme `npm run check` und `git diff --check`; keine Geheimnisse im Repository; kein lokaler PHP-Server; bestehende Mechaniken nicht stillschweigend ändern.
7. **Kapitelabschlüsse:** **B — trennen.** Kapitel 6 endet mit abgeschlossener Relaisreparatur; Kapitel 7 benötigt danach einen eigenen sichtbaren Spielerimpuls, vorzugsweise die explizite Aktion „Fernsignal scannen“.

## Projektstand

- M1, M2, M3.1 und M3.2 sind in `dev` integriert.
- PR #21 (`feature/m3-3-signal-impulse`) ist offen, gepusht und noch nicht gemergt.
- PR #21 muss vor dem Merge auf den getrennten Kapitel-7-Abschluss angepasst und anschließend vollständig geprüft werden.
- `main` bleibt die stabile Release-Linie; `dev` ist die Integrationslinie.
- Backend und Deployment warten auf das vom Owner bereitgestellte Online-Ziel und die FTP-/API-Konfiguration; Zugangsdaten dürfen nie eingecheckt werden.

## Priorisierte Folgearbeiten

1. PR #21 fachlich und technisch prüfen, Kapitel 6/7 entkoppeln, CI abnehmen und nach `dev` mergen.
2. Erstes datengetriebenes Beispielmodul samt Manifest, Versionierung und Validierung umsetzen, ohne Kerncode für das Beispiel zu ändern.
3. GitHub-Login mit unveränderlicher interner MERGEFORGE-Spieler-ID implementieren; GitHub-ID dient als MVP-Verknüpfung, Username nur als Anzeige.
4. Online-Persistenz und getrennte regelkonforme Startsektoren für mindestens zwei Testspieler implementieren.
5. Contributor-/PR-Prüfung und vollständigen Releaseweg `feature → dev → main` automatisieren.

## Nicht vorziehen

- Kein Kapitel 8 vor Abschluss des MVP-Backlogs.
- Kein echtes Nachbardorf, fremdes Gelände, PvP, Handel oder Straßenbau zwischen Sektoren in M3.3.
- Keine Backend- oder Hostingannahmen ohne Owner-Daten.
