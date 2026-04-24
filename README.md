# Snowboard Stammtisch Innsbruck

Static site, Cloudflare Pages–ready. No build step.

## Deploy auf Cloudflare Pages

1. Repo zu GitHub/GitLab pushen
2. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. Projekt-Settings:
   - Framework preset: **None**
   - Build command: *(leer)*
   - Build output directory: `/`
4. **Save and Deploy** → URL ist live

Die `_headers`-Datei sorgt für korrektes Caching (JSON-Content cached nur 60s, damit Änderungen schnell durchkommen).

## Content pflegen

Alle Inhalte liegen als JSON im Repo — pushen = deployen.

- **`content/dates.json`** — Termine pro Saison. `current: true` markiert die aktive Saison.
- **`content/config.json`** — Location, Intro-Text (DE/EN), Partner, Links.

Beispiel neuer Termin:
```json
{ "label": "2025/26", "current": true, "dates": ["2025-11-20", "2025-12-18", ...] }
```

Cloudflare re-deployt automatisch bei jedem Push (~30s).

## Lokal anschauen

```bash
# irgendein statischer Server
python3 -m http.server 8000
# oder
npx serve
```

Hinweis: `file://` direkt im Browser geht auch — die Seite hat einen Inline-Fallback für JSON.

## Struktur

```
index.html           — Hauptseite
impressum.html       — Impressum
assets/
  styles.css         — alles Styling
  app.js             — Render-Logik, i18n, Animationen
  paper-texture.svg  — Papier-Hintergrund
  logo-*.png         — Partner-Logos
content/
  config.json        — CMS: Location, Text, Partner
  dates.json         — CMS: Termine
_headers             — Cloudflare Caching-Rules
```

## Custom Domain

Im Pages-Projekt → **Custom domains** → Domain hinzufügen. Cloudflare setzt die DNS-Einträge automatisch wenn die Domain bei Cloudflare liegt; sonst CNAME manuell.
