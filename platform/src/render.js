import {
  absoluteUrl,
  compareIsoDate,
  daysBetweenIso,
  escapeHtml,
  formatDate,
  localDateIso,
  safeAssetUrl,
  safeExternalUrl,
  weekdayLabel
} from "./utils.js";

function rand(seed) {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

function strikeSvg(seed) {
  const random = rand(seed || 1);
  const strokes = [];
  const count = 1 + Math.floor(random() * 2) + (random() > 0.6 ? 1 : 0);
  for (let index = 0; index < count; index += 1) {
    const baseY = 48 + random() * 14 + index * (random() > 0.5 ? 3 : -2);
    const x1 = -4 + random() * 6;
    const x2 = 98 + random() * 8;
    const segments = 7 + Math.floor(random() * 3);
    let path = `M ${x1.toFixed(1)} ${(baseY + (random() - 0.5) * 4).toFixed(1)}`;
    for (let segment = 1; segment <= segments; segment += 1) {
      const t = segment / segments;
      const x = x1 + (x2 - x1) * t;
      const y = baseY + Math.sin(t * Math.PI * (1 + random())) * (1.5 + random() * 2) + (random() - 0.5) * 3;
      const previousT = (segment - 1) / segments;
      const cx = x1 + (x2 - x1) * (previousT + 0.5 / segments);
      const cy = baseY + (random() - 0.5) * 6;
      path += ` Q ${cx.toFixed(1)} ${cy.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    const width = 8 + random() * 4;
    const opacity = 0.75 + random() * 0.2;
    strokes.push(`<path class="stroke" style="stroke-width:${width.toFixed(1)};opacity:${opacity.toFixed(2)}" d="${path}" />`);
  }
  return `<svg class="marker" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${strokes.join("")}</svg>`;
}

function circleSvg(seed) {
  const random = rand(seed || 42);
  const cx = 50;
  const cy = 50;
  const rx = 47 + random() * 3;
  const ry = 40 + random() * 4;
  const rotation = (random() - 0.5) * 0.25;
  const points = [];
  const startAngle = -18 + random() * 10;
  const endAngle = startAngle + 380 + random() * 15;
  for (let angle = startAngle; angle <= endAngle; angle += 8) {
    const radians = (angle + Math.sin(angle * 0.05) * 2) * Math.PI / 180;
    const jitter = (random() - 0.5) * 3;
    const radiusX = rx + jitter + Math.sin(radians * 2) * 1.2;
    const radiusY = ry + jitter + Math.cos(radians * 3) * 0.8;
    const x = cx + radiusX * Math.cos(radians) * Math.cos(rotation) - radiusY * Math.sin(radians) * Math.sin(rotation);
    const y = cy + radiusX * Math.cos(radians) * Math.sin(rotation) + radiusY * Math.sin(radians) * Math.cos(rotation);
    points.push([x, y]);
  }
  const path = points.reduce((value, point, index) => {
    const command = index === 0 ? "M" : "L";
    return `${value} ${command} ${point[0].toFixed(1)} ${point[1].toFixed(1)}`;
  }, "");
  return `<svg class="marker" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="circle" d="${path.trim()}" /></svg>`;
}

function eventState(events, todayIso) {
  const active = events.filter((event) => event.status !== "cancelled");
  const nextIndex = active.findIndex((event) => compareIsoDate(event.starts_on, todayIso) >= 0);
  return { active, nextIndex };
}

function statusLabel(events, nextIndex, todayIso) {
  if (nextIndex < 0) return { text: "Saison vorbei", className: "status-over" };
  const days = daysBetweenIso(todayIso, events[nextIndex].starts_on);
  if (days === 0) return { text: "HEUTE", className: "status-urgent" };
  if (days === 1) return { text: "MORGEN", className: "status-urgent" };
  return {
    text: `NOCH ${days} TAGE`,
    className: days <= 3 ? "status-urgent" : ""
  };
}

function photosByEvent(photos) {
  const grouped = new Map();
  for (const photo of photos) {
    const key = String(photo.event_id ?? "");
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(photo);
  }
  return grouped;
}

function renderPhotos(photos, event, site) {
  if (!photos?.length) return "";
  return `
    <div class="photo-strip open" aria-label="Fotos vom ${escapeHtml(formatDate(event.starts_on, site.locale))}">
      ${photos.map((photo, index) => {
        const url = safeAssetUrl(photo.url);
        if (!url) return "";
        const alt = photo.alt_text || `${site.shortName} am ${formatDate(event.starts_on, site.locale)}`;
        const rotation = ((index % 5) - 2) * 0.6;
        return `<a class="polaroid" style="transform:rotate(${rotation}deg)" href="${escapeHtml(url)}" target="_blank" rel="noopener"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async"></a>`;
      }).join("")}
    </div>`;
}

function renderEvents(site, todayIso) {
  const { active, nextIndex } = eventState(site.events, todayIso);
  const groupedPhotos = photosByEvent(site.photos);
  return active.map((event, index) => {
    const isPast = nextIndex < 0 || index < nextIndex;
    const isNext = index === nextIndex;
    const classes = ["date", isPast ? "past" : "", isNext ? "next" : ""].filter(Boolean).join(" ");
    const marker = isPast ? strikeSvg(index + 1) : (isNext ? circleSvg(index + 7) : "");
    const meta = `${weekdayLabel(event.starts_on, site.locale)}${isNext ? " · nächstes Mal" : ""}`;
    const photoCount = groupedPhotos.get(String(event.id))?.length || 0;
    const special = event.special_label ? `<span class="date-special">${escapeHtml(event.special_label)}</span>` : "";
    return `
      <li class="${classes}" data-date="${escapeHtml(event.starts_on)}" style="--delay:${(0.15 + index * 0.12).toFixed(2)}s">
        <span class="date-text-wrap">
          <a class="date-text-btn" href="/calendar.ics" aria-label="${escapeHtml(formatDate(event.starts_on, site.locale))} in Kalender übernehmen">
            <span class="date-text">${escapeHtml(formatDate(event.starts_on, site.locale))}</span>
          </a>
          ${marker}
        </span>
        <span class="date-meta">${escapeHtml(meta)}${photoCount ? ` <span class="photo-badge">· ${photoCount} 📷</span>` : ""}</span>
        ${special}
        ${renderPhotos(groupedPhotos.get(String(event.id)), event, site)}
      </li>`;
  }).join("");
}

function renderLinks(site) {
  const links = [];
  if (site.links.whatsapp && !site.links.whatsapp.includes("REPLACE_ME")) {
    links.push(`<a class="pill pill--whatsapp" href="${escapeHtml(safeExternalUrl(site.links.whatsapp))}" target="_blank" rel="noopener"><span class="pill-dot"></span>WhatsApp Gruppe</a>`);
  }
  if (site.links.boardSwap && !site.links.boardSwap.includes("REPLACE_ME")) {
    links.push(`<a class="pill pill--boardSwap" href="${escapeHtml(safeExternalUrl(site.links.boardSwap))}" target="_blank" rel="noopener"><span class="pill-dot"></span>Boards tauschen</a>`);
  }
  return links.join("");
}

function renderPartners(site) {
  return site.partners.map((partner) => {
    const logoUrl = safeAssetUrl(partner.logo_url);
    const content = logoUrl
      ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(partner.name)}" loading="lazy" decoding="async">`
      : `<span class="partner-name">${escapeHtml(partner.name)}</span>`;
    const className = `partner partner--${escapeHtml(partner.shape || (logoUrl ? "badge" : "text"))}`;
    if (partner.url) {
      return `<a class="${className}" href="${escapeHtml(safeExternalUrl(partner.url))}" target="_blank" rel="noopener">${content}</a>`;
    }
    return `<div class="${className}">${content}</div>`;
  }).join("");
}

function normalizeImprintUrl(site) {
  if (!site.imprintUrl) return "/impressum";
  if (site.imprintUrl.startsWith("/")) return site.imprintUrl;
  return safeExternalUrl(site.imprintUrl, "/impressum");
}

function assetUrl(site, path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return site.assetOrigin ? `${site.assetOrigin}${normalized}` : normalized;
}

function inlineEnhancements() {
  return `
    .platform-origin{font-size:9px;letter-spacing:.16em;text-transform:uppercase;opacity:.35;margin-top:14px}
    .date-text-btn{text-decoration:none}
    .photo-strip.open{justify-content:flex-start}
    .photo-strip .polaroid{display:block}
    .empty-events{margin:0 auto 42px;text-align:center;font-size:14px;opacity:.65}
    .domain-error{max-width:680px;margin:12vh auto;padding:32px;font-family:system-ui,sans-serif}
    .domain-error code{word-break:break-all}
  `;
}

function clientScript() {
  return `
    (() => {
      const key = "stammtisch-theme";
      const root = document.documentElement;
      const stored = localStorage.getItem(key) || "auto";
      function apply(value) {
        let effective = value;
        if (effective === "auto") {
          const hour = new Date().getHours();
          effective = hour >= 20 || hour < 6 ? "dark" : "light";
        }
        root.dataset.theme = effective;
      }
      apply(stored);
      const button = document.getElementById("theme-toggle");
      if (button) button.addEventListener("click", () => {
        const current = root.dataset.theme;
        const next = current === "dark" ? "light" : "dark";
        localStorage.setItem(key, next);
        apply(next);
      });
    })();
  `;
}

export function renderCrewPage(site, requestUrl, now = new Date()) {
  const todayIso = localDateIso(now, site.timezone);
  const { active, nextIndex } = eventState(site.events, todayIso);
  const status = statusLabel(active, nextIndex, todayIso);
  const canonicalHostname = site.primaryHostname || site.requestedHostname;
  const canonical = absoluteUrl(canonicalHostname, requestUrl.pathname === "/" ? "/" : requestUrl.pathname);
  const title = site.name;
  const description = site.metaDescription || site.intro;
  const logoUrl = safeAssetUrl(site.logoUrl || assetUrl(site, "/assets/sbi-logo.svg"));
  const cssUrl = assetUrl(site, "/assets/styles.css?v=29");
  const metaImage = safeAssetUrl(site.metaImageUrl || logoUrl);
  const locationHref = safeExternalUrl(site.location.mapsUrl);
  const totalEvents = site.events.length;
  const years = Math.max(1, now.getUTCFullYear() - site.startedInYear + 1);

  return `<!doctype html>
<html lang="${escapeHtml(site.language)}" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#f6ecd8">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  ${metaImage ? `<meta property="og:image" content="${escapeHtml(metaImage)}">` : ""}
  <meta name="twitter:card" content="summary_large_image">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,400;0,500;0,600;0,900;1,500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${escapeHtml(cssUrl)}">
  <style>${inlineEnhancements()}</style>
</head>
<body>
  <main class="page">
    <div class="topbar">
      <span id="status-pill" class="${escapeHtml(status.className)}"><span class="dot"></span><span id="status-label">${escapeHtml(status.text)}</span></span>
      <div class="topbar-right">
        <button id="theme-toggle" class="theme-toggle" aria-label="Darstellung wechseln" title="Darstellung wechseln">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.9-.1-1.35A5.5 5.5 0 0 1 13 4c-.03-.34-.03-.68 0-1A9 9 0 0 0 12 3z"/></svg>
        </button>
      </div>
    </div>

    <header class="logo">
      ${logoUrl ? `<img class="logo-img" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(site.name)}" width="200" height="200">` : `<strong>${escapeHtml(site.shortName)}</strong>`}
    </header>

    <h1 class="saison">Saison <span>${escapeHtml(site.seasonLabel)}</span></h1>

    ${active.length ? `<ul class="dates" id="dates">${renderEvents(site, todayIso)}</ul>` : `<p class="empty-events">Neue Termine folgen.</p>`}

    ${active.length ? `<div class="ics-row"><a id="ics-all" class="ics-btn" href="/calendar.ics">Alle Termine · Kalender</a></div>` : ""}

    <section class="info">
      <p class="intro">${escapeHtml(site.intro)}</p>
      <div class="meta">
        <div>
          <strong>Wo</strong>
          ${site.location.mapsUrl ? `<a href="${escapeHtml(locationHref)}" target="_blank" rel="noopener">${escapeHtml(site.location.name)}</a>` : `<span>${escapeHtml(site.location.name)}</span>`}
        </div>
        <div>
          <strong>Wann</strong>
          <span>ab ${escapeHtml(site.timeLabel)}</span>
        </div>
        <div>
          <strong>Wie</strong>
          <span>einfach kommen</span>
        </div>
      </div>
      <div class="links">${renderLinks(site)}</div>
    </section>

    <footer class="footer">
      ${site.partners.length ? `<div class="powered-by">Powered by</div><div class="partners">${renderPartners(site)}</div>` : ""}
      <div class="footer-meta">
        <a href="${escapeHtml(normalizeImprintUrl(site))}">Impressum</a>
        <span>© ${now.getUTCFullYear()} ${escapeHtml(site.shortName)}</span>
      </div>
      ${(site.credits.logo || site.credits.website) ? `<div class="footer-meta" style="margin-top:12px">${site.credits.logo ? `<span>Logo Design: ${escapeHtml(site.credits.logo)}</span>` : ""}${site.credits.website ? `<span>Website: ${escapeHtml(site.credits.website)}</span>` : ""}</div>` : ""}
      <div class="stats">Seit ${years} ${years === 1 ? "Saison" : "Saisons"} · ${totalEvents} Stammtische</div>
      <div class="platform-origin">${escapeHtml(site.domain.kind)} · ${escapeHtml(site.requestedHostname)}</div>
    </footer>
  </main>
  <div class="grain" aria-hidden="true"></div>
  <script>${clientScript()}</script>
</body>
</html>`;
}

export function renderUnknownDomain(hostname) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Stammtisch nicht gefunden</title><style>${inlineEnhancements()}</style></head><body><main class="domain-error"><h1>Diese Domain ist noch keinem Stammtisch zugeordnet.</h1><p>Hostname: <code>${escapeHtml(hostname)}</code></p></main></body></html>`;
}
