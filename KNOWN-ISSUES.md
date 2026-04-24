# Known Issues — Snowboard Stammtisch Website

Stand: 2026-04-24

## Aktive Issues

### HIGH — Impressum XSS via KV-Config

`impressum.html:57` — Impressum-Body wird per `innerHTML = cfg.imprint` aus KV geladen. Wenn ein Admin boesartiges HTML in die Config schreibt, wird es ungefiltert gerendert. Risiko gering (nur Admins koennen schreiben), aber technisch ein stored XSS.

**Fix:** Impressum-HTML serverseitig sanitizen oder nur Plaintext erlauben.

### MEDIUM — showStatus() XSS in Admin

`admin/admin.js:24` — `bar.innerHTML = \`<div class="status status-${type}">${msg}</div>\`` — `msg` kommt teilweise von Server-Responses (`err.error`). Server-kontrolliert, aber bei kompromittiertem Backend wuerde HTML injected.

**Fix:** `textContent` statt `innerHTML` verwenden.

### MEDIUM — CORS Wildcard auf OPTIONS

`functions/_middleware.js:7` — `Access-Control-Allow-Origin` wird auf `request.headers.get("Origin") || "*"` gesetzt. Bei OPTIONS-Requests ohne Origin-Header: Wildcard. In Kombination mit `Allow-Credentials: true` ignorieren Browser das zwar, aber es ist nicht best-practice.

**Fix:** Feste Origin-Liste oder nur die Pages-Domain erlauben.

### MEDIUM — Impressum Platzhalter

`impressum.html:30` — Strasse und E-Mail sind noch Platzhalter (`[Strasse, Hausnr.]`, `[email]`). Impressumspflicht nicht erfuellt.

### LOW — README veraltet

Die bestehende README beschrieb die alte Static-Only-Architektur. Admin-Dashboard, Photo-System, Auth und API-Endpoints fehlten komplett. → Aktualisiert mit diesem Scan.

### LOW — GitHub Pages Integration disconnected

CF Pages Auto-Deploy via GitHub ist nicht mehr verbunden. Deployments muessen manuell per `wrangler pages deploy .` erfolgen.

### LOW — CSS Version in impressum.html veraltet

`impressum.html:10` — Referenziert `styles.css?v=15`, Hauptseite ist bei `v=19`. Impressum bekommt moegliche CSS-Updates nicht.

## Scan-Ergebnisse (Static Analysis)

| Kategorie | Anzahl | Bewertung |
|-----------|--------|-----------|
| SEC-02 innerHTML | 22 | Grossteils false positives (Admin-Only Context, Server-kontrollierte Daten). 1 echtes Issue (Impressum KV). |
| SEC-11 CORS | 1 | Medium — Wildcard mit Credentials |
| SEC-10 Cookie | 1 | False positive — Cookie hat HttpOnly + Secure + SameSite=Strict |
| R30 Module-level let | ~20 | Akzeptabel — Vanilla JS ohne Module-System braucht mutable State |
| R4 no-var | ~20 | False positive — Scanner erkennt `let` faelschlich als `var` |

## Behobene Issues (diese Session)

- **Upload Silent Fail (CRITICAL):** Admin-UI zeigte "Fotos hochgeladen" auch bei Server-Fehlern. `api()` Helper warf nur bei 401, nicht bei 400/500. → Gefixt: `res.ok` Check + Fehlermeldung
- **Foto-Layout Chaos:** `flex-wrap` + ±4° Rotation erzeugte chaotische Fotowand bei >4 Fotos → Gefixt: Filmstrip (horizontal scroll), Rotation ±1.5°
- **CSS Duplikat:** `.date.past .date-text-btn` Regeln doppelt definiert (Zeile 191 + 361) → Gefixt: Zusammengefuehrt
