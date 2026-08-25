export function normalizeHostname(value) {
  if (!value) return "";
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function safeExternalUrl(value, fallback = "#") {
  if (!value) return fallback;
  try {
    const url = new URL(String(value));
    return ["https:", "http:"].includes(url.protocol) ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

export function safeAssetUrl(value, fallback = "") {
  if (!value) return fallback;
  const text = String(value).trim();
  if (text.startsWith("/")) return text;
  return safeExternalUrl(text, fallback);
}

export function parseJson(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function localDateIso(date, timeZone = "Europe/Vienna") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function compareIsoDate(left, right) {
  return String(left).localeCompare(String(right));
}

export function daysBetweenIso(fromIso, toIso) {
  const from = isoDateToUtc(fromIso);
  const to = isoDateToUtc(toIso);
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

export function isoDateToUtc(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!match) throw new TypeError(`Invalid ISO date: ${iso}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function formatDate(iso, locale = "de-AT") {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(isoDateToUtc(iso));
}

export function weekdayLabel(iso, locale = "de-AT") {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "short"
  })
    .format(isoDateToUtc(iso))
    .replace(".", "")
    .toUpperCase();
}

export function absoluteUrl(hostname, path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `https://${normalizeHostname(hostname)}${normalizedPath}`;
}

export function responseHtml(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": status === 200 ? "public, max-age=60, s-maxage=300" : "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      ...extraHeaders
    }
  });
}

export function responseJson(value, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders
    }
  });
}

export function responseRedirect(location, status = 308) {
  return new Response(null, {
    status,
    headers: {
      location,
      "cache-control": "public, max-age=300"
    }
  });
}

export function slugify(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
