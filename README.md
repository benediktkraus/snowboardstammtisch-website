# Snowboard Stammtisch Innsbruck

Event-Website fuer den monatlichen Snowboard-Stammtisch in Innsbruck. Zeigt Termine mit Countdown, Foto-Galerie pro Termin, Partner und ICS-Export. Zweisprachig (DE/EN), Dark Mode, kein Build-Step.

**Live:** [snowboardstammtisch-website.pages.dev](https://snowboardstammtisch-website.pages.dev)

## How It Works

Die Seite laeuft komplett auf Cloudflare Pages (Static Files + Pages Functions) mit KV als Datenbank. Kein Framework, kein Build, kein npm.

1. **Besucher** oeffnet die Seite → `index.html` laedt, `app.js` fetcht Config + Dates von `/api/content` (Fallback: Inline-JSON im HTML)
2. **Termine** werden gerendert: vergangene durchgestrichen (Marker-SVG), naechster eingekreist, Countdown-Badge zeigt Tage
3. **Fotos** laden als horizontaler Filmstrip (Polaroid-Thumbnails) unter vergangenen Terminen. Klick oeffnet Lightbox
4. **Admin** loggt sich ein unter `/admin/` → JWT-Cookie-Session → kann Termine, Config, Fotos, Impressum verwalten
5. **Daten** liegen in Cloudflare KV (Namespace `SBI`): Config, Dates, Password-Hash, JWT-Secret, Foto-Binaries + Indices

Statische Fallback-JSONs (`content/config.json`, `content/dates.json`) werden beim ersten Admin-Login per Seed-Endpoint nach KV migriert.

## Features

- **Termine** mit animierten Marker-SVGs (Durchstreichung + Einkreisung)
- **Countdown** zum naechsten Termin (Today/Tomorrow/X Tage)
- **Foto-Galerie** pro Termin: Filmstrip mit Polaroid-Look, max 10 Fotos, Lightbox
- **ICS-Export** (Einzeltermin + ganze Saison)
- **Admin-Dashboard** (Passwort-geschuetzt): Termine, Config, Fotos, Analytics, Passwort-Aenderung
- **Zweisprachig** (DE/EN) mit localStorage-Persistenz
- **Dark Mode** (Auto nach Uhrzeit, manuell togglebar)
- **Archiv** vergangener Saisons mit aufklappbarer Foto-Galerie
- **Partner-Logos** im Footer (Badge/Wordmark/Text-Varianten)
- **Cookie-freie Analytics** via Cloudflare Web Analytics
- **Zero Dependencies** — kein npm, kein Build, kein Framework

## Tech Stack

| Layer | Technologie |
|-------|------------|
| Hosting | Cloudflare Pages |
| Backend | Cloudflare Pages Functions (Workers Runtime) |
| Datenbank | Cloudflare KV (Namespace: SBI) |
| Auth | PBKDF2 (100K Iterations) + JWT (HMAC-SHA256) via Web Crypto API |
| Frontend | Vanilla HTML/CSS/JS |
| Analytics | Cloudflare Web Analytics (cookie-free) |
| Fonts | Google Fonts (Archivo) |

## Projekt-Struktur

```
index.html                    Hauptseite (Termine, Fotos, Partner)
impressum.html                Impressum (KV-ueberschreibbar)
admin/
  index.html                  Admin Dashboard SPA
  admin.js                    Admin Client-Logik
assets/
  app.js                      Frontend Render-Logik, i18n, Lightbox
  styles.css                  Komplettes Styling (Paper-Texture, Dark Mode)
  paper-texture.svg           Hintergrund-Pattern
  logo-*.png                  Partner-Logos
content/
  config.json                 Static Fallback: Location, Intro, Partner
  dates.json                  Static Fallback: Seasons + Termine
functions/
  _middleware.js               CORS fuer alle API-Routes
  _auth.js                    Auth-Library (PBKDF2, JWT, Cookies)
  api/
    auth.js                   POST Login → JWT Cookie
    setup.js                  GET/POST Ersteinrichtung (Password setzen)
    content.js                GET Public Content (KV → Static Fallback)
    photos/
      list.js                 GET Foto-Liste pro Datum
      serve.js                GET Foto-Binary (JPEG)
    admin/
      config.js               GET/PUT Config (auth)
      dates.js                GET/PUT Termine (auth)
      seed.js                 POST Static → KV Migration (auth)
      password.js             PUT Password aendern (auth)
      photos.js               POST Upload / DELETE Foto (auth, max 10)
      analytics.js            GET CF Web Analytics via GraphQL (auth)
wrangler.toml                 CF Pages Config + KV Binding
_headers                      Caching-Rules
```

## API Endpoints

### Public (kein Auth)

| Method | Path | Beschreibung |
|--------|------|-------------|
| GET | `/api/content?type=config\|dates` | Config oder Dates aus KV (Fallback: Static JSON) |
| GET | `/api/setup` | Pruefen ob Ersteinrichtung noetig |
| GET | `/api/photos/list?date=YYYY-MM-DD` | Foto-Keys fuer ein Datum |
| GET | `/api/photos/serve?key=photo:DATE:N` | Foto-Binary (JPEG) |

### Admin (JWT Cookie erforderlich)

| Method | Path | Beschreibung |
|--------|------|-------------|
| POST | `/api/auth` | Login → setzt `sbi-admin` Cookie (24h) |
| POST | `/api/setup` | Ersteinrichtung: Passwort setzen (einmalig) |
| POST | `/api/admin/seed` | Static JSON → KV migrieren |
| GET/PUT | `/api/admin/config` | Config lesen/schreiben |
| GET/PUT | `/api/admin/dates` | Termine lesen/schreiben |
| PUT | `/api/admin/password` | Passwort aendern |
| POST | `/api/admin/photos` | Foto hochladen (max 2MB, max 10/Termin) |
| DELETE | `/api/admin/photos?key=...` | Foto loeschen |
| GET | `/api/admin/analytics` | Web Analytics (CF GraphQL) |

## Getting Started

### Voraussetzungen

- Cloudflare-Account mit Pages-Zugang
- KV-Namespace erstellen (ID in `wrangler.toml` eintragen)

### Deploy

Automatisch bei `git push origin main` via GitHub Actions.
Manuell: `CLOUDFLARE_API_TOKEN=... npx wrangler pages deploy . --project-name snowboardstammtisch-website`

### Ersteinrichtung

1. Seite oeffnen → `/admin/`
2. Passwort festlegen (min. 6 Zeichen)
3. Login → Static JSON wird automatisch nach KV geseeded
4. Termine, Config, Fotos ueber das Dashboard verwalten

### Lokal testen

```bash
npx wrangler pages dev . --kv SBI
```

## Backup & Restore

Alle Daten (Fotos, Config, Termine, Passwort) liegen in Cloudflare KV. Backup-Scripts liegen in `scripts/`.

**Backup ausfuehren:**
```bash
./scripts/backup.sh
```
Sichert alle KV-Keys nach `/mnt/onedrive/Workspace/backups/sbi-kv/YYYY-MM-DD/`. Laeuft automatisch Sonntags 03:17 via Cron.

**Restore (nach Datenverlust):**
```bash
./scripts/restore.sh                                          # letztes Backup
./scripts/restore.sh /mnt/onedrive/Workspace/backups/sbi-kv/2026-04-25  # bestimmtes Backup
```
Fragt Bestaetigung, dann schreibt es alle Keys zurueck ins KV.

**Backup pruefen:**
```bash
ls /mnt/onedrive/Workspace/backups/sbi-kv/
cat /var/log/sbi-kv-backup.log
```

## Architecture

Siehe [ARCHITECTURE.md](ARCHITECTURE.md) fuer Details.

## Credits

- **Logo Design:** Lisa Rasch
- **Website:** Benedikt Kraus
- **Impressum:** Paul Popp
