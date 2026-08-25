import { normalizeHostname, parseJson } from "./utils.js";

const DOMAIN_SQL = `
  SELECT
    d.hostname AS requested_hostname,
    d.kind AS domain_kind,
    d.is_primary,
    d.redirect_to_primary,
    d.status AS domain_status,
    s.*
  FROM site_domains d
  INNER JOIN sites s ON s.id = d.site_id
  WHERE d.hostname = ?1
    AND d.status = 'active'
    AND s.status = 'active'
  LIMIT 1
`;

const SITE_BY_ID_SQL = `
  SELECT
    '' AS requested_hostname,
    'development' AS domain_kind,
    0 AS is_primary,
    0 AS redirect_to_primary,
    'active' AS domain_status,
    s.*
  FROM sites s
  WHERE s.id = ?1
    AND s.status = 'active'
  LIMIT 1
`;

const PRIMARY_DOMAIN_SQL = `
  SELECT hostname
  FROM site_domains
  WHERE site_id = ?1 AND status = 'active'
  ORDER BY is_primary DESC, kind = 'custom' DESC, created_at ASC
  LIMIT 1
`;

const EVENTS_SQL = `
  SELECT id, starts_on, starts_at, title, special_label, status
  FROM events
  WHERE site_id = ?1 AND status != 'deleted'
  ORDER BY starts_on ASC, starts_at ASC, id ASC
`;

const PARTNERS_SQL = `
  SELECT id, name, url, logo_url, role, shape, sort_order
  FROM partners
  WHERE site_id = ?1 AND status = 'active'
  ORDER BY sort_order ASC, id ASC
`;

const PHOTOS_SQL = `
  SELECT id, event_id, url, alt_text, sort_order
  FROM photos
  WHERE site_id = ?1 AND status = 'active'
  ORDER BY event_id ASC, sort_order ASC, id ASC
`;

async function first(statement) {
  const result = await statement.first();
  return result ?? null;
}

async function all(statement) {
  const result = await statement.all();
  return Array.isArray(result) ? result : result?.results ?? [];
}

function isLocalDevelopmentHost(hostname) {
  return hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1";
}

export function createD1Repository(env) {
  if (!env?.DB) {
    throw new Error("Missing D1 binding: env.DB");
  }

  return {
    async getSiteByHostname(rawHostname) {
      const hostname = normalizeHostname(rawHostname);
      let row = await first(env.DB.prepare(DOMAIN_SQL).bind(hostname));

      if (!row && isLocalDevelopmentHost(hostname) && env.DEFAULT_SITE_ID) {
        row = await first(env.DB.prepare(SITE_BY_ID_SQL).bind(env.DEFAULT_SITE_ID));
      }

      if (!row) return null;

      const [primaryDomain, events, partners, photos] = await Promise.all([
        first(env.DB.prepare(PRIMARY_DOMAIN_SQL).bind(row.id)),
        all(env.DB.prepare(EVENTS_SQL).bind(row.id)),
        all(env.DB.prepare(PARTNERS_SQL).bind(row.id)),
        all(env.DB.prepare(PHOTOS_SQL).bind(row.id))
      ]);

      return hydrateSite(row, {
        hostname,
        primaryHostname: primaryDomain?.hostname || hostname,
        events,
        partners,
        photos,
        assetOriginFallback: env.ASSET_ORIGIN || ""
      });
    }
  };
}

export function hydrateSite(row, related = {}) {
  const locale = row.locale || "de-AT";
  const intro = parseJson(row.intro_json, {});
  const credits = parseJson(row.credits_json, {});

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.short_name || row.name,
    status: row.status,
    locale,
    language: locale.split("-")[0] || "de",
    timezone: row.timezone || "Europe/Vienna",
    seasonLabel: row.season_label || "",
    startedInYear: Number(row.started_in_year || new Date().getUTCFullYear()),
    intro: intro[locale] || intro[locale.split("-")[0]] || intro.de || row.meta_description || "",
    metaDescription: row.meta_description || intro.de || "",
    metaImageUrl: row.meta_image_url || "",
    timeLabel: row.time_label || "20:00",
    location: {
      name: row.location_name || "",
      address: row.location_address || "",
      mapsUrl: row.location_maps_url || ""
    },
    links: {
      whatsapp: row.whatsapp_url || "",
      boardSwap: row.board_swap_url || ""
    },
    logoUrl: row.logo_url || "",
    assetOrigin: String(row.asset_origin || related.assetOriginFallback || "").replace(/\/$/, ""),
    imprintUrl: row.imprint_url || "/impressum",
    credits,
    requestedHostname: related.hostname || row.requested_hostname || "",
    primaryHostname: normalizeHostname(related.primaryHostname || related.hostname || row.requested_hostname || ""),
    domain: {
      kind: row.domain_kind || "custom",
      isPrimary: Boolean(row.is_primary),
      redirectToPrimary: Boolean(row.redirect_to_primary)
    },
    events: related.events || [],
    partners: related.partners || [],
    photos: related.photos || []
  };
}
