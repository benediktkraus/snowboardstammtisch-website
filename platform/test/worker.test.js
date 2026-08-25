import test from "node:test";
import assert from "node:assert/strict";

import { createHandler } from "../src/index.js";
import { hydrateSite } from "../src/repository.js";
import { normalizeHostname } from "../src/utils.js";

function makeSite(overrides = {}) {
  return {
    id: "innsbruck",
    slug: "innsbruck",
    name: "Snowboard Stammtisch Innsbruck",
    shortName: "Snowboard Stammtisch Innsbruck",
    status: "active",
    locale: "de-AT",
    language: "de",
    timezone: "Europe/Vienna",
    seasonLabel: "2026/27",
    startedInYear: 2022,
    intro: "Einmal im Monat. Bier, Boards, Leute. Kommt vorbei.",
    metaDescription: "Einmal im Monat. Snowboard Stammtisch in Innsbruck.",
    metaImageUrl: "",
    timeLabel: "20:00",
    location: {
      name: "Hopfmann und Söhne",
      address: "Pfarrgasse 6, 6020 Innsbruck",
      mapsUrl: "https://example.com/maps"
    },
    links: {
      whatsapp: "https://example.com/whatsapp",
      boardSwap: ""
    },
    logoUrl: "https://assets.example/logo.svg",
    assetOrigin: "https://assets.example",
    imprintUrl: "https://assets.example/impressum.html",
    credits: { logo: "Lisa Rasch", website: "Benedikt Kraus" },
    requestedHostname: "innsbruck.stammtisch.test",
    primaryHostname: "snowboardstammtisch.example",
    domain: {
      kind: "platform",
      isPrimary: false,
      redirectToPrimary: false
    },
    events: [
      {
        id: 1,
        starts_on: "2026-09-17",
        starts_at: "20:00",
        title: "Snowboard Stammtisch Innsbruck",
        special_label: "Season Opening",
        status: "scheduled"
      },
      {
        id: 2,
        starts_on: "2026-10-15",
        starts_at: "20:00",
        title: "Snowboard Stammtisch Innsbruck",
        special_label: "",
        status: "scheduled"
      }
    ],
    partners: [
      {
        id: 1,
        name: "Hopfmann und Söhne",
        url: "https://example.com/host",
        logo_url: "https://assets.example/host.png",
        shape: "wordmark"
      }
    ],
    photos: [
      {
        id: 1,
        event_id: 1,
        url: "https://assets.example/photo.jpg",
        alt_text: "Crew photo",
        sort_order: 0
      }
    ],
    ...overrides
  };
}

function repositoryFor(siteOrResolver) {
  return () => ({
    async getSiteByHostname(hostname) {
      if (typeof siteOrResolver === "function") return siteOrResolver(hostname);
      return siteOrResolver;
    }
  });
}

const fixedNow = () => new Date("2026-08-25T05:00:00.000Z");

test("normalizes hostnames before tenant lookup", () => {
  assert.equal(normalizeHostname("HTTPS://Innsbruck.Stammtisch.Test:8787/path"), "innsbruck.stammtisch.test");
  assert.equal(normalizeHostname("SnowboardStammtisch.Example."), "snowboardstammtisch.example");
});

test("renders the platform subdomain from site data with custom-domain canonical", async () => {
  const handler = createHandler({ repositoryFactory: repositoryFor(makeSite()), now: fixedNow });
  const response = await handler.fetch(new Request("https://innsbruck.stammtisch.test/"), {
    ASSET_ORIGIN: "https://assets.example"
  });
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.match(html, /Snowboard Stammtisch Innsbruck/);
  assert.match(html, /Saison <span>2026\/27<\/span>/);
  assert.match(html, /NOCH 23 TAGE/);
  assert.match(html, /17\.09\.2026/);
  assert.match(html, /Season Opening/);
  assert.match(html, /Crew photo/);
  assert.match(html, /rel="canonical" href="https:\/\/snowboardstammtisch\.example\/"/);
  assert.match(html, /platform · innsbruck\.stammtisch\.test/);
});

test("redirects a configured alias to the primary domain and preserves path/query", async () => {
  const alias = makeSite({
    requestedHostname: "alias.example",
    domain: { kind: "custom", isPrimary: false, redirectToPrimary: true }
  });
  const handler = createHandler({ repositoryFactory: repositoryFor(alias), now: fixedNow });
  const response = await handler.fetch(new Request("https://alias.example/calendar.ics?source=qr"), {});

  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://snowboardstammtisch.example/calendar.ics?source=qr");
});

test("returns a branded 404 when the hostname is not mapped", async () => {
  const handler = createHandler({ repositoryFactory: repositoryFor(null), now: fixedNow });
  const response = await handler.fetch(new Request("https://unknown.example/"), {});
  const html = await response.text();

  assert.equal(response.status, 404);
  assert.match(html, /noch keinem Stammtisch zugeordnet/);
  assert.match(html, /unknown\.example/);
});

test("exposes a public site payload for product integrations", async () => {
  const handler = createHandler({ repositoryFactory: repositoryFor(makeSite()), now: fixedNow });
  const response = await handler.fetch(new Request("https://innsbruck.stammtisch.test/api/site"), {});
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.id, "innsbruck");
  assert.equal(payload.primaryHostname, "snowboardstammtisch.example");
  assert.equal(payload.events.length, 2);
  assert.equal(payload.events[0].startsOn, "2026-09-17");
});

test("exports an iCalendar feed for upcoming events", async () => {
  const handler = createHandler({ repositoryFactory: repositoryFor(makeSite()), now: fixedNow });
  const response = await handler.fetch(new Request("https://innsbruck.stammtisch.test/calendar.ics"), {});
  const calendar = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/calendar/);
  assert.match(calendar, /BEGIN:VCALENDAR/);
  assert.match(calendar, /DTSTART;TZID=Europe\/Vienna:20260917T200000/);
  assert.match(calendar, /URL:https:\/\/snowboardstammtisch\.example\//);
});

test("hydrates D1 rows into a stable product model", () => {
  const site = hydrateSite({
    id: "crew-1",
    slug: "crew-1",
    name: "Crew One",
    locale: "de-AT",
    timezone: "Europe/Vienna",
    intro_json: '{"de":"Hallo Crew"}',
    credits_json: '{"website":"Benedikt"}',
    is_primary: 1,
    redirect_to_primary: 0,
    domain_kind: "custom",
    status: "active"
  }, {
    hostname: "crew.example",
    primaryHostname: "crew.example",
    events: [],
    partners: [],
    photos: []
  });

  assert.equal(site.intro, "Hallo Crew");
  assert.equal(site.credits.website, "Benedikt");
  assert.equal(site.domain.isPrimary, true);
  assert.equal(site.requestedHostname, "crew.example");
});
