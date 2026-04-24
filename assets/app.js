// ============================================
// Snowboard Stammtisch Innsbruck — render logic
// ============================================

const I18N = {
  de: {
    tag: "Saison läuft",
    tagOver: "Saison vorbei",
    season: "Saison",
    where: "Wo",
    when: "Wann",
    how: "Wie",
    "how-value": "einfach kommen",
    archive: "Archiv",
    poweredby: "Powered by",
    imprint: "Impressum",
    weekday: ["SO","MO","DI","MI","DO","FR","SA"],
    nextLabel: "nächstes Mal",
    timePrefix: "ab",
    today: "heute",
    tomorrow: "morgen",
    daysLeft: "Tage",
    today_short: "HEUTE",
    ics_all: "Alle Termine · Kalender",
    ics_one: "In Kalender",
    whatsapp: "WhatsApp Gruppe",
    boardSwap: "Boards tauschen",
    stats: (seasons, events) => `Seit ${seasons} ${seasons === 1 ? "Saison" : "Saisons"} · ${events} Stammtische`,
    themeLight: "Hell",
    themeDark: "Dunkel",
    htmlLang: "de"
  },
  en: {
    tag: "Season is on",
    tagOver: "Season is over",
    season: "Season",
    where: "Where",
    when: "When",
    how: "How",
    "how-value": "just show up",
    archive: "Archive",
    poweredby: "Powered by",
    imprint: "Imprint",
    weekday: ["SUN","MON","TUE","WED","THU","FRI","SAT"],
    nextLabel: "next one",
    timePrefix: "from",
    today: "today",
    tomorrow: "tomorrow",
    daysLeft: "days",
    today_short: "TODAY",
    ics_all: "Add season to calendar",
    ics_one: "Add to calendar",
    whatsapp: "WhatsApp group",
    boardSwap: "Swap boards",
    stats: (seasons, events) => `${seasons} ${seasons === 1 ? "season" : "seasons"} · ${events} meet-ups`,
    themeLight: "Light",
    themeDark: "Dark",
    htmlLang: "en"
  }
};

let currentLang = localStorage.getItem("sbi-lang") || (navigator.language?.startsWith("en") ? "en" : "de");
let currentTheme = localStorage.getItem("sbi-theme") || "auto"; // auto | light | dark
let CONFIG = null;
let DATES = null;

// ---- helpers ----
function parseISO(s) {
  const [y,m,d] = s.split("-").map(Number);
  return new Date(y, m-1, d);
}
function fmtDate(iso) {
  const d = parseISO(iso);
  return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
}
function weekdayLabel(iso, lang) {
  return I18N[lang].weekday[parseISO(iso).getDay()];
}
function rand(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}
function daysUntil(iso) {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = parseISO(iso);
  return Math.round((d - today) / 86400000);
}

// ---- marker svgs: organic, jittery, like felt-tip ----
function strikeSvg(seed) {
  const r = rand(seed || 1);
  const strokes = [];
  // 1-3 passes, slightly offset, different widths
  const count = 1 + Math.floor(r() * 2) + (r() > 0.6 ? 1 : 0);
  for (let i = 0; i < count; i++) {
    // break into small segments for jitter
    const baseY = 48 + r() * 14 + i * (r() > 0.5 ? 3 : -2);
    const x1 = -4 + r() * 6;
    const x2 = 98 + r() * 8;
    const segments = 7 + Math.floor(r() * 3);
    let d = `M ${x1.toFixed(1)} ${(baseY + (r()-0.5)*4).toFixed(1)}`;
    for (let s = 1; s <= segments; s++) {
      const t = s / segments;
      const x = x1 + (x2 - x1) * t;
      const y = baseY + Math.sin(t * Math.PI * (1 + r())) * (1.5 + r() * 2) + (r() - 0.5) * 3;
      // control points
      const prevT = (s-1)/segments;
      const cx = x1 + (x2-x1)*(prevT + 0.5/segments);
      const cy = baseY + (r()-0.5) * 6;
      d += ` Q ${cx.toFixed(1)} ${cy.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    const width = 8 + r() * 4;
    const opacity = 0.75 + r() * 0.2;
    strokes.push(`<path class="stroke" style="stroke-width:${width.toFixed(1)};opacity:${opacity.toFixed(2)}" d="${d}" />`);
  }
  return `<svg class="marker" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${strokes.join("")}</svg>`;
}

function circleSvg(seed) {
  const r = rand(seed || 42);
  const cx = 50, cy = 50;
  const rx = 47 + r() * 3, ry = 40 + r() * 4;
  const rot = (r() - 0.5) * 0.25;
  const pts = [];
  // go around 1.1 times — loop slightly overshoots like a real pen
  const startAngle = -18 + r() * 10;
  const endAngle = startAngle + 380 + r() * 15;
  for (let a = startAngle; a <= endAngle; a += 8) {
    const rad = (a + Math.sin(a*0.05)*2) * Math.PI / 180;
    const j = (r() - 0.5) * 3;
    const rrx = rx + j + Math.sin(rad*2) * 1.2;
    const rry = ry + j + Math.cos(rad*3) * 0.8;
    const x = cx + rrx * Math.cos(rad) * Math.cos(rot) - rry * Math.sin(rad) * Math.sin(rot);
    const y = cy + rrx * Math.cos(rad) * Math.sin(rot) + rry * Math.sin(rad) * Math.cos(rot);
    pts.push([x, y]);
  }
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
  return `<svg class="marker" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="circle" d="${d}" /></svg>`;
}

function findNextIndex(dates) {
  const today = new Date(); today.setHours(0,0,0,0);
  for (let i = 0; i < dates.length; i++) if (parseISO(dates[i]) >= today) return i;
  return -1;
}

// ---- ics export ----
function toICSDate(iso, time) {
  const [y,m,d] = iso.split("-");
  const [h,min] = (time || "20:00").split(":");
  return `${y}${m}${d}T${h.padStart(2,"0")}${min.padStart(2,"0")}00`;
}
function icsEvent(iso, cfg) {
  const start = toICSDate(iso, cfg.time);
  const [y,m,d] = iso.split("-").map(Number);
  const endDate = new Date(y, m-1, d, parseInt(cfg.time?.split(":")[0] || 20) + 4);
  const end = `${endDate.getFullYear()}${String(endDate.getMonth()+1).padStart(2,"0")}${String(endDate.getDate()).padStart(2,"0")}T${String(endDate.getHours()).padStart(2,"0")}${String(endDate.getMinutes()).padStart(2,"0")}00`;
  const loc = `${cfg.location?.name || ""}, ${cfg.location?.address || ""}`.replace(/,\s*$/, "");
  const uid = `sbi-${iso}@snowboard-stammtisch-innsbruck`;
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g,"").split(".")[0]}Z`,
    `DTSTART;TZID=Europe/Vienna:${start}`,
    `DTEND;TZID=Europe/Vienna:${end}`,
    "SUMMARY:Snowboard Stammtisch Innsbruck",
    `LOCATION:${loc}`,
    "DESCRIPTION:Einmal im Monat. Bier\\, Boards\\, Leute. Kommt vorbei.",
    "END:VEVENT"
  ].join("\r\n");
}
function buildICS(events, cfg) {
  const body = events.map(iso => icsEvent(iso, cfg)).join("\r\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Snowboard Stammtisch Innsbruck//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Vienna",
    "BEGIN:STANDARD",
    "DTSTART:19701025T030000",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0100",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "TZNAME:CET",
    "END:STANDARD",
    "BEGIN:DAYLIGHT",
    "DTSTART:19700329T020000",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0200",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "TZNAME:CEST",
    "END:DAYLIGHT",
    "END:VTIMEZONE",
    body,
    "END:VCALENDAR"
  ].join("\r\n");
}
function downloadICS(filename, content) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---- theme ----
function applyTheme() {
  let eff = currentTheme;
  if (eff === "auto") {
    const h = new Date().getHours();
    eff = (h >= 20 || h < 6) ? "dark" : "light";
  }
  document.documentElement.dataset.theme = eff;
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.dataset.state = currentTheme;
}

// ---- render sections ----
function renderI18nLabels(t) {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const k = el.getAttribute("data-i18n");
    if (typeof t[k] === "string") el.textContent = t[k];
  });
  document.querySelectorAll(".lang-switch button").forEach(b => {
    b.classList.toggle("active", b.dataset.lang === currentLang);
  });
}

function renderIntroAndMeta(t) {
  document.getElementById("intro").textContent = CONFIG.intro?.[currentLang] || CONFIG.intro?.de || "";
  const loc = document.getElementById("location-link");
  loc.textContent = CONFIG.location?.name || "";
  loc.href = CONFIG.location?.mapsUrl || "#";
  document.getElementById("time-label").textContent = `${t.timePrefix} ${CONFIG.time || ""}`;
}

function renderDates(t) {
  const current = DATES.seasons.find(s => s.current) || DATES.seasons[0];
  document.getElementById("season-label").textContent = current.label;

  const datesEl = document.getElementById("dates");
  datesEl.innerHTML = "";
  const nextIdx = findNextIndex(current.dates);

  const statusLabel = document.getElementById("status-label");
  const statusPill = document.getElementById("status-pill");
  if (statusLabel && statusPill) {
    if (nextIdx === -1) {
      statusLabel.textContent = t.tagOver;
      statusPill.classList.add("status-over");
    } else {
      statusLabel.textContent = t.tag;
      statusPill.classList.remove("status-over");
    }
  }

  // countdown ribbon
  const countdown = document.getElementById("countdown");
  if (countdown) {
    if (nextIdx === -1) {
      countdown.hidden = true;
    } else {
      const days = daysUntil(current.dates[nextIdx]);
      let msg;
      if (days === 0) msg = t.today_short;
      else if (days === 1) msg = t.tomorrow.toUpperCase();
      else msg = `${days} ${t.daysLeft.toUpperCase()}`;
      countdown.textContent = msg;
      countdown.hidden = false;
      countdown.classList.toggle("urgent", days <= 3);
    }
  }

  current.dates.forEach((iso, i) => {
    const isPast = nextIdx === -1 ? true : i < nextIdx;
    const isNext = i === nextIdx;
    const li = document.createElement("li");
    li.className = "date" + (isPast ? " past" : "") + (isNext ? " next" : "");
    li.style.setProperty("--delay", `${0.15 + i * 0.12}s`);

    const wrap = document.createElement("span");
    wrap.className = "date-text-wrap";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "date-text-btn";
    const text = document.createElement("span");
    text.className = "date-text";
    text.textContent = fmtDate(iso);
    btn.appendChild(text);

    if (isPast) {
      // Past dates: no ICS, click toggles photo strip
      btn.title = "";
      btn.setAttribute("aria-label", fmtDate(iso));
      btn.addEventListener("click", () => togglePhotoStrip(li, iso));
    } else {
      // Future/next dates: ICS download
      btn.title = t.ics_one;
      btn.setAttribute("aria-label", `${fmtDate(iso)} — ${t.ics_one}`);
      btn.addEventListener("click", () => {
        const ics = buildICS([iso], CONFIG);
        downloadICS(`stammtisch-${iso}.ics`, ics);
      });
    }
    wrap.appendChild(btn);

    if (isPast) wrap.insertAdjacentHTML("beforeend", strikeSvg(i + 1));
    if (isNext) wrap.insertAdjacentHTML("beforeend", circleSvg(i + 7));

    const meta = document.createElement("span");
    meta.className = "date-meta";
    meta.textContent = isNext
      ? `${weekdayLabel(iso, currentLang)} · ${t.nextLabel}`
      : weekdayLabel(iso, currentLang);

    li.appendChild(wrap);
    li.appendChild(meta);
    // Polaroid strip placeholder (loaded on click or auto for most recent past)
    const strip = document.createElement("div");
    strip.className = "photo-strip";
    strip.id = `strip-${iso}`;
    li.appendChild(strip);
    datesEl.appendChild(li);

    // Auto-load + auto-open photos for the most recent past date
    if (isPast && i === (nextIdx === -1 ? current.dates.length - 1 : nextIdx - 1)) {
      loadPhotoStrip(strip, iso).then(() => strip.classList.add("open"));
    }
  });

  // "Alle Termine" button
  const allBtn = document.getElementById("ics-all");
  if (allBtn) {
    const upcoming = nextIdx === -1 ? current.dates : current.dates.slice(nextIdx);
    allBtn.hidden = upcoming.length === 0;
    allBtn.textContent = t.ics_all;
    allBtn.onclick = () => {
      const ics = buildICS(upcoming, CONFIG);
      downloadICS(`stammtisch-${current.label.replace("/","-")}.ics`, ics);
    };
  }

  // stats line: since year · X sessions total across all seasons
  const statsEl = document.getElementById("stats");
  if (statsEl) {
    const totalEvents = DATES.seasons.reduce((a,s) => a + (s.dates?.length || 0), 0);
    const seasonCount = DATES.seasons.length;
    statsEl.textContent = t.stats(seasonCount, totalEvents);
  }
}

function renderArchive(t) {
  const past = DATES.seasons.filter(s => !s.current);
  const archiveWrap = document.getElementById("archive");
  const archiveList = document.getElementById("archive-list");
  if (!past.length) { archiveWrap.hidden = true; return; }
  archiveWrap.hidden = false;
  archiveList.innerHTML = "";
  past.forEach(season => {
    const details = document.createElement("details");
    details.className = "archive-season";
    const summary = document.createElement("summary");
    summary.textContent = `${t.season} ${season.label}`;
    details.appendChild(summary);
    const ul = document.createElement("ul");
    ul.className = "archive-dates";
    season.dates.forEach((iso, i) => {
      const li = document.createElement("li");
      li.innerHTML = `${fmtDate(iso)}${strikeSvg(i+3)}`;
      ul.appendChild(li);
    });
    details.appendChild(ul);
    // Load photos lazily on open
    details.addEventListener("toggle", () => {
      if (details.open) loadArchivePhotos(details, season.dates);
    });
    archiveList.appendChild(details);
  });
}

function renderLinks(t) {
  const wrap = document.getElementById("links");
  if (!wrap) return;
  wrap.innerHTML = "";
  const links = CONFIG.links || {};
  const configs = [
    { key: "whatsapp", label: t.whatsapp, icon: "💬" },
    { key: "boardSwap", label: t.boardSwap, icon: "🛹" }
  ];
  configs.forEach(c => {
    const url = links[c.key];
    if (!url || url.includes("REPLACE_ME")) return;
    const a = document.createElement("a");
    a.className = "pill pill--" + c.key;
    a.href = url; a.target = "_blank"; a.rel = "noopener";
    a.innerHTML = `<span class="pill-dot"></span>${c.label}`;
    wrap.appendChild(a);
  });
}

function renderPartners() {
  const partnersEl = document.getElementById("partners");
  if (!partnersEl) return;
  partnersEl.innerHTML = "";
  const partners = Array.isArray(CONFIG.partners) ? CONFIG.partners : [];
  partners.forEach(p => {
    if (!p || !p.name) return;
    const el = p.url ? document.createElement("a") : document.createElement("div");
    const shape = p.shape || (p.logo ? "badge" : "text");
    el.className = "partner partner--" + shape;
    if (p.url) { el.href = p.url; el.target = "_blank"; el.rel = "noopener"; }
    if (p.logo) {
      const img = document.createElement("img");
      img.src = p.logo;
      img.alt = p.name;
      img.decoding = "async";
      el.appendChild(img);
    } else {
      const name = document.createElement("span");
      name.className = "partner-name";
      const parts = p.name.split(/\s+und\s+/i);
      if (parts.length === 2) {
        name.appendChild(document.createTextNode(parts[0] + " "));
        const und = document.createElement("span");
        und.className = "und";
        und.textContent = "und";
        name.appendChild(und);
        name.appendChild(document.createTextNode(" " + parts[1]));
      } else {
        name.textContent = p.name;
      }
      el.appendChild(name);
    }
    partnersEl.appendChild(el);
  });
}

function render() {
  const t = I18N[currentLang];
  document.documentElement.lang = t.htmlLang;
  if (!CONFIG || !DATES) return;
  applyTheme();
  renderI18nLabels(t);
  renderIntroAndMeta(t);
  renderDates(t);
  renderArchive(t);
  renderLinks(t);
  renderPartners();
  document.getElementById("year").textContent = new Date().getFullYear();
}

// ---- lang switch ----
document.querySelectorAll(".lang-switch button").forEach(b => {
  b.addEventListener("click", () => {
    currentLang = b.dataset.lang;
    localStorage.setItem("sbi-lang", currentLang);
    render();
  });
});

// ---- theme toggle ----
document.addEventListener("click", (e) => {
  const btn = e.target.closest("#theme-toggle");
  if (!btn) return;
  // cycle: auto -> light -> dark -> auto
  currentTheme = currentTheme === "auto" ? "light" : (currentTheme === "light" ? "dark" : "auto");
  localStorage.setItem("sbi-theme", currentTheme);
  applyTheme();
});

// ---- photo strips (polaroid thumbnails inline) ----

async function loadPhotoStrip(container, date) {
  if (container.dataset.loaded) return;
  container.dataset.loaded = "1";
  try {
    const keys = await fetch(`/api/photos/list?date=${date}`).then(r => r.json());
    if (!keys.length) return;
    keys.forEach((key, i) => {
      const polaroid = document.createElement("div");
      polaroid.className = "polaroid";
      // Random slight rotation for organic feel
      const rot = (Math.random() - 0.5) * 8;
      polaroid.style.transform = `rotate(${rot.toFixed(1)}deg)`;
      const img = document.createElement("img");
      img.src = `/api/photos/serve?key=${encodeURIComponent(key)}`;
      img.loading = "lazy";
      img.alt = "";
      img.addEventListener("click", () => openLightbox(keys, i));
      polaroid.appendChild(img);
      container.appendChild(polaroid);
    });
    container.classList.add("has-photos");
  } catch {}
}

function togglePhotoStrip(li, date) {
  const strip = li.querySelector(".photo-strip");
  if (!strip) return;
  if (strip.classList.contains("open")) {
    strip.classList.remove("open");
  } else {
    loadPhotoStrip(strip, date);
    strip.classList.add("open");
  }
}

// ---- data load ----
function loadInlineFallback() {
  return {
    cfg: JSON.parse(document.getElementById("config-fallback").textContent),
    dates: JSON.parse(document.getElementById("dates-fallback").textContent)
  };
}

async function load() {
  try {
    const [cfg, dates] = await Promise.all([
      fetch("/api/content?type=config").then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch("/api/content?type=dates").then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    ]);
    CONFIG = cfg; DATES = dates;
  } catch (err) {
    console.warn("API fetch failed, using inline fallback:", err.message);
    const fb = loadInlineFallback();
    CONFIG = fb.cfg; DATES = fb.dates;
  }
  render();
}

// ---- photo gallery in archive ----

async function loadArchivePhotos(details, dates) {
  // Load photos for each date when <details> is opened
  if (details.dataset.photosLoaded) return;
  details.dataset.photosLoaded = "1";
  for (const iso of dates) {
    try {
      const keys = await fetch(`/api/photos/list?date=${iso}`).then(r => r.json());
      if (!keys.length) continue;
      const grid = document.createElement("div");
      grid.className = "archive-photos";
      keys.forEach(key => {
        const img = document.createElement("img");
        img.src = `/api/photos/serve?key=${encodeURIComponent(key)}`;
        img.loading = "lazy";
        img.alt = "";
        img.dataset.key = key;
        img.addEventListener("click", () => openLightbox(keys, keys.indexOf(key)));
        grid.appendChild(img);
      });
      // Insert after the date list
      details.appendChild(grid);
    } catch {}
  }
}

// ---- lightbox ----

let lightboxKeys = [];
let lightboxIdx = 0;

function openLightbox(keys, idx) {
  lightboxKeys = keys;
  lightboxIdx = idx;
  const lb = document.getElementById("lightbox");
  const img = document.getElementById("lightbox-img");
  img.src = `/api/photos/serve?key=${encodeURIComponent(keys[idx])}`;
  lb.hidden = false;
}

function closeLightbox() {
  document.getElementById("lightbox").hidden = true;
  document.getElementById("lightbox-img").src = "";
}

function lightboxNav(dir) {
  lightboxIdx = (lightboxIdx + dir + lightboxKeys.length) % lightboxKeys.length;
  document.getElementById("lightbox-img").src = `/api/photos/serve?key=${encodeURIComponent(lightboxKeys[lightboxIdx])}`;
}

document.getElementById("lightbox-close")?.addEventListener("click", closeLightbox);
document.getElementById("lightbox-prev")?.addEventListener("click", () => lightboxNav(-1));
document.getElementById("lightbox-next")?.addEventListener("click", () => lightboxNav(1));
document.getElementById("lightbox")?.addEventListener("click", e => {
  if (e.target.id === "lightbox") closeLightbox();
});
document.addEventListener("keydown", e => {
  const lb = document.getElementById("lightbox");
  if (!lb || lb.hidden) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") lightboxNav(-1);
  if (e.key === "ArrowRight") lightboxNav(1);
});

load();
