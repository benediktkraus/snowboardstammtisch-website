-- Safe example data for local development. Replace the .test/.example hostnames
-- with the real platform subdomain and customer domain before production deploy.

INSERT INTO sites (
  id, slug, name, short_name, status, locale, timezone, season_label,
  started_in_year, intro_json, meta_description, time_label,
  location_name, location_address, location_maps_url,
  whatsapp_url, board_swap_url, logo_url, asset_origin, imprint_url, credits_json
) VALUES (
  'innsbruck',
  'innsbruck',
  'Snowboard Stammtisch Innsbruck',
  'Snowboard Stammtisch Innsbruck',
  'active',
  'de-AT',
  'Europe/Vienna',
  '2025/26',
  2022,
  '{"de":"Einmal im Monat. Bier, Boards, Leute. Kommt vorbei.","en":"Once a month. Beer, boards, people. Come through."}',
  'Einmal im Monat. Snowboard Stammtisch in Innsbruck.',
  '20:00',
  'Hopfmann und Söhne',
  'Pfarrgasse 6, 6020 Innsbruck',
  'https://www.google.com/maps/search/?api=1&query=Hopfmann+S%C3%B6hne%2C+Pfarrgasse+6%2C+6020+Innsbruck',
  '',
  '',
  'https://snowboardstammtisch-website.pages.dev/assets/sbi-logo.svg?v=4',
  'https://snowboardstammtisch-website.pages.dev',
  'https://snowboardstammtisch-website.pages.dev/impressum.html',
  '{"logo":"Lisa Rasch","website":"Benedikt Kraus"}'
)
ON CONFLICT(id) DO UPDATE SET
  slug = excluded.slug,
  name = excluded.name,
  short_name = excluded.short_name,
  status = excluded.status,
  locale = excluded.locale,
  timezone = excluded.timezone,
  season_label = excluded.season_label,
  started_in_year = excluded.started_in_year,
  intro_json = excluded.intro_json,
  meta_description = excluded.meta_description,
  time_label = excluded.time_label,
  location_name = excluded.location_name,
  location_address = excluded.location_address,
  location_maps_url = excluded.location_maps_url,
  whatsapp_url = excluded.whatsapp_url,
  board_swap_url = excluded.board_swap_url,
  logo_url = excluded.logo_url,
  asset_origin = excluded.asset_origin,
  imprint_url = excluded.imprint_url,
  credits_json = excluded.credits_json,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO site_domains (
  hostname, site_id, kind, status, is_primary, redirect_to_primary, verified_at
) VALUES
  ('innsbruck.stammtisch.test', 'innsbruck', 'platform', 'active', 0, 0, CURRENT_TIMESTAMP),
  ('snowboardstammtisch.example', 'innsbruck', 'custom', 'active', 1, 0, CURRENT_TIMESTAMP)
ON CONFLICT(hostname) DO UPDATE SET
  site_id = excluded.site_id,
  kind = excluded.kind,
  status = excluded.status,
  is_primary = excluded.is_primary,
  redirect_to_primary = excluded.redirect_to_primary,
  verified_at = excluded.verified_at;

INSERT OR IGNORE INTO events (site_id, starts_on, starts_at, title, status) VALUES
  ('innsbruck', '2025-11-20', '20:00', 'Snowboard Stammtisch Innsbruck', 'scheduled'),
  ('innsbruck', '2025-12-18', '20:00', 'Snowboard Stammtisch Innsbruck', 'scheduled'),
  ('innsbruck', '2026-01-15', '20:00', 'Snowboard Stammtisch Innsbruck', 'scheduled'),
  ('innsbruck', '2026-02-19', '20:00', 'Snowboard Stammtisch Innsbruck', 'scheduled'),
  ('innsbruck', '2026-03-19', '20:00', 'Snowboard Stammtisch Innsbruck', 'scheduled'),
  ('innsbruck', '2026-04-16', '20:00', 'Snowboard Stammtisch Innsbruck', 'scheduled');

INSERT INTO partners (site_id, name, url, logo_url, role, shape, sort_order)
SELECT 'innsbruck', 'Hopfmann und Söhne', 'https://www.hopfmann.at/', 'https://snowboardstammtisch-website.pages.dev/assets/logo-hopfmann.png', 'host', 'wordmark', 10
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE site_id = 'innsbruck' AND name = 'Hopfmann und Söhne');

INSERT INTO partners (site_id, name, url, logo_url, role, shape, sort_order)
SELECT 'innsbruck', 'Waxelbude', '', 'https://snowboardstammtisch-website.pages.dev/assets/logo-waxelbude.png', 'partner', 'badge', 20
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE site_id = 'innsbruck' AND name = 'Waxelbude');
