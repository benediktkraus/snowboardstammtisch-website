# PROGRESS.md — Snowboard Stammtisch Website

## 2026-04-25

### Unified photo rendering (current + archive seasons)
- **Problem:** Aktuelle Saison hatte Polaroid-Filmstrip mit Click-Toggle, Archiv hatte komplett anderen Code (flaches Grid, kein Click, kein Polaroid)
- **Fix:** Gemeinsame `renderPastDate()` Funktion, genutzt von `renderDates()` und `renderArchive()`. Identisches Verhalten ueberall.
- **Geloescht:** `loadArchivePhotos()`, `.archive-photos` CSS Grid

### Photo upload key collision fix
- **Problem:** `nextIdx = index.length` nach Delete von nicht-letztem Foto → ueberschreibt bestehendes Foto
- **Fix:** `nextIdx = max(existing indices) + 1`

### Photo count badge
- Vergangene Termine zeigen `· N 📷` neben dem Wochentag wenn Fotos vorhanden sind (async check, kein Aufklappen noetig)

### Auto-Deploy via GitHub Actions
- `.github/workflows/deploy.yml` — deployed automatisch bei Push auf `main`
- GitHub Secrets gesetzt: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- Kein manuelles `wrangler pages deploy` mehr noetig

### KV-Backup
- Backup-Script: `/mnt/onedrive/Workspace/scripts/backup-sbi-kv.sh`
- Sichert alle KV-Keys (Config, Dates, Password-Hash, 28 Fotos) nach `/mnt/onedrive/Workspace/backups/sbi-kv/YYYY-MM-DD/`
- Idempotent (ueberspringt bereits gesicherte Dateien)
- Manifest mit Metadaten pro Key
- Erstes Backup: 2026-04-25, 37/37 Keys, 0 Fehler

### Infrastruktur-Status
- **CF Pages:** snowboardstammtisch-website.pages.dev (kein Custom Domain)
- **KV:** Namespace SBI, 37 Keys (28 Fotos, Config, Dates, Auth)
- **GitHub:** benediktkraus/snowboardstammtisch-website, Auto-Deploy aktiv
- **Kein Backup-Cron** — Script muss manuell ausgeloest werden (Cron empfohlen)
