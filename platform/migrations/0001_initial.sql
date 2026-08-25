PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'deleted')),
  locale TEXT NOT NULL DEFAULT 'de-AT',
  timezone TEXT NOT NULL DEFAULT 'Europe/Vienna',
  season_label TEXT,
  started_in_year INTEGER,
  intro_json TEXT NOT NULL DEFAULT '{}',
  meta_description TEXT,
  meta_image_url TEXT,
  time_label TEXT NOT NULL DEFAULT '20:00',
  location_name TEXT,
  location_address TEXT,
  location_maps_url TEXT,
  whatsapp_url TEXT,
  board_swap_url TEXT,
  logo_url TEXT,
  asset_origin TEXT,
  imprint_url TEXT,
  credits_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_domains (
  hostname TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'custom' CHECK (kind IN ('platform', 'custom')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'blocked')),
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  redirect_to_primary INTEGER NOT NULL DEFAULT 0 CHECK (redirect_to_primary IN (0, 1)),
  verification_token TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS site_domains_one_primary
  ON site_domains(site_id)
  WHERE is_primary = 1 AND status = 'active';

CREATE INDEX IF NOT EXISTS site_domains_by_site
  ON site_domains(site_id, status);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  starts_on TEXT NOT NULL,
  starts_at TEXT NOT NULL DEFAULT '20:00',
  title TEXT,
  special_label TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'deleted')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_id, starts_on, starts_at)
);

CREATE INDEX IF NOT EXISTS events_by_site_date
  ON events(site_id, starts_on, starts_at);

CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT,
  logo_url TEXT,
  role TEXT,
  shape TEXT NOT NULL DEFAULT 'badge' CHECK (shape IN ('badge', 'wordmark', 'text')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS partners_by_site
  ON partners(site_id, status, sort_order);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'deleted')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS photos_by_site_event
  ON photos(site_id, event_id, status, sort_order);
