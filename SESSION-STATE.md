# SESSION-STATE.md

## Aktives Ziel
Photo-Rendering vereinheitlicht, Infra abgesichert

## Letzter Stand
- Unified `renderPastDate()` fuer aktuelle + Archiv-Saisons deployed
- Photo-Upload Key-Kollision gefixt
- Photo-Badge (Anzahl ohne Aufklappen) deployed
- GitHub Actions Auto-Deploy eingerichtet und verifiziert
- KV-Backup Script gebaut und erfolgreich getestet (37/37 Keys)
- Alle Aenderungen live auf snowboardstammtisch-website.pages.dev

## Entscheidungen
- Eine `renderPastDate()` Funktion statt zwei Code-Pfade
- Photo-Badge als `· N 📷` im date-meta Span (async fetch, kein Layout-Shift)
- KV-Backup als Bash-Script (nicht Cron) — User entscheidet ob automatisch
- Auto-Deploy via GitHub Actions statt CF Pages GitHub-Integration (flexibler)
- Key-Kollision-Fix: `max(existing indices) + 1` statt Counter in KV

## Offene Punkte
- KV-Backup Cron einrichten (wöchentlich empfohlen)
- Andere 3 CF Pages Projekte brauchen eigene GitHub Repos fuer Auto-Deploy
- Kein Custom Domain konfiguriert
- Security Headers (CSP, X-Frame-Options) fehlen
- CORS ist offen (Origin-Reflection + Credentials)
- WhatsApp Links sind Platzhalter (REPLACE_ME)

## Naechste Schritte
- Optional: Backup-Cron
- Optional: Repos + Auto-Deploy fuer benediktkraus-com, podcast-engine, lisa-jahrestag
