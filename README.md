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

### Deployment

```bash
# Option A: wrangler CLI
wrangler pages deploy . --project-name=snowboardstammtisch-website

# Option B: GitHub-Integration (wenn verbunden)
git push origin main
```

### Ersteinrichtung

1. Seite oeffnen → `/admin/`
2. Passwort festlegen (min. 6 Zeichen)
3. Login → Static JSON wird automatisch nach KV geseeded
4. Termine, Config, Fotos ueber das Dashboard verwalten

### Lokal testen

```bash
python3 -m http.server 8000
# oder
npx serve
```

Hinweis: API-Endpoints (KV) funktionieren nur deployed. Lokal greift der Inline-JSON-Fallback.

## Architecture

Siehe [ARCHITECTURE.md](ARCHITECTURE.md) fuer Details.

## Credits

- **Logo Design:** Lisa Rasch
- **Website:** Benedikt Kraus
- **Impressum:** Paul Popp
