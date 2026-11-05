# Härtungs-Audit (2026-11-05)

Code-Lektüre von API (`api/`), Frontend und Domain, ohne Ausführung gegen die Live-Seite. Ein Befund wurde nicht einzeln nachgestellt, sondern aus dem Code gelesen.

## Bereits in Ordnung

SQL nur mit Prepared Statements. Session-Cookie HttpOnly, Secure, SameSite=Lax. OAuth-State signiert und einmalig. Markt-Schreibvorgänge in Transaktionen (Doppel-Accept ausgeschlossen). Mengen auf 1 bis 50 begrenzt. Kein `dangerouslySetInnerHTML`, `innerHTML` oder `eval`; Spielernamen werden als Text gerendert. `loadGame` prüft streng (kein NaN/Infinity, keine Endlosschleifen).

## Umgesetzt in dieser Runde

- API 0.7.1: `display_errors` aus, globaler Exception-Handler antwortet mit `{"ok":false,"error":"server-error"}` statt PHP-Fehlerseite mit Pfaden/SQL.
- `.htaccess` (Web und API): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`.
- `api/.htaccess`: `lib/`, `tests/`, `data/` per URL gesperrt.

## Offen, nach Schwere

| # | Schwere | Befund | Fix-Idee |
|---|---|---|---|
| H1 | Hoch | Markt prüft nie, ob der Verkäufer die Ware besitzt. Zwei Accounts können Ressourcen erzeugen (bekannte Grenze aus D-021: Spielstand ist client-autoritativ). Client bucht erst nach dem Server-Call ab; Reload dazwischen verdoppelt Ware. | Vor offenem Start: Server-Bestand/Abbuchung beim Anlegen des Angebots prüfen. |
| H2 | Hoch/Mittel | `save_payload_error` prüft nur Form und Größe, nicht Werte. Hängt mit H1 zusammen. | Kernwerte serverseitig begrenzen; echte Sicherheit nur mit Server-Simulation. |
| H3 | Mittel | Ungültiger Online-Save wird beim Reset gelöscht und vom frischen Stand überschrieben, ohne Vorversion. | Rohstring vorher sichern, Hochladen erst nach Bestätigung; Serverhistorie der letzten Stände. |
| H4 | Mittel | Systemuhr weit vorstellen und ein Tick friert den Spielstand ein (`lastAdvancedAtMs` in der Zukunft). | Beim Laden und im Tick auf `Date.now()` + wenige Minuten begrenzen. |
| H5 | Mittel | CORS mit Credentials auch für `www.red-it.org` und localhost in Produktion; leerer Origin wird durchgelassen. | Nur `https://mergeforge.red-it.org`; localhost per Config-Flag. |
| H6 | Mittel | Kein Rate-Limiting (Angebote, Cancel, Inbox wächst unbegrenzt). | Limit pro Spieler/Minute; Cap für offene Inbox-Zeilen. |
| H7 | Niedrig | Inbox-Auslieferung kann bei 50 nicht passenden Zeilen vorn „verhungern"; verlorene Claim-Antwort bedeutet verlorene Ware. | Claim idempotent machen. |
| H8 | Niedrig | Sessions 30 Tage, Logout löscht nur das Cookie. | `session_epoch` pro Spieler, kürzere Laufzeit. |
| H9 | Niedrig | Keine CSP und kein HSTS. | CSP erst nach Test mit Pixi und Vite-Build einführen; HSTS erst nach http→https-Umleitung im Hoster-Panel. |
| H10 | Niedrig | SQLite-Datei liegt im Web-Root (`api/data`), Schutz nur per `.htaccess`. | `data_dir` in der Config außerhalb des Web-Roots. |
| H11 | Niedrig | Offene Angebote laufen nie ab; bei gesperrten Spielern hängt die Ware. | `expires_at` und Storno bei `denied`. |
