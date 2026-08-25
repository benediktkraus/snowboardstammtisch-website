import { slugify } from "./utils.js";

function escapeIcs(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function compactDate(iso, time) {
  const [year, month, day] = String(iso).split("-");
  const [hour = "20", minute = "00"] = String(time || "20:00").split(":");
  return `${year}${month}${day}T${hour.padStart(2, "0")}${minute.padStart(2, "0")}00`;
}

function addHours(iso, time, hours) {
  const [year, month, day] = String(iso).split("-").map(Number);
  const [hour = 20, minute = 0] = String(time || "20:00").split(":").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour + hours, minute));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}00`;
}

export function buildCalendar(site, events, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const body = events.map((event) => {
    const title = event.title || site.name;
    const location = [site.location.name, site.location.address].filter(Boolean).join(", ");
    return [
      "BEGIN:VEVENT",
      `UID:${slugify(site.id)}-${event.id || event.starts_on}@${site.primaryHostname || "stammtisch"}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${site.timezone}:${compactDate(event.starts_on, event.starts_at || site.timeLabel)}`,
      `DTEND;TZID=${site.timezone}:${addHours(event.starts_on, event.starts_at || site.timeLabel, 4)}`,
      `SUMMARY:${escapeIcs(title)}`,
      `LOCATION:${escapeIcs(location)}`,
      `DESCRIPTION:${escapeIcs(site.intro)}`,
      `URL:https://${site.primaryHostname}/`,
      "END:VEVENT"
    ].join("\r\n");
  }).join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${escapeIcs(site.name)}//Stammtisch Platform//DE`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    body,
    "END:VCALENDAR"
  ].filter(Boolean).join("\r\n");
}
