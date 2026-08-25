# Stammtisch Platform — Domain-Resolution Slice

This directory is the first deployable multi-site product slice built from the existing Snowboard Stammtisch Innsbruck website.

## What is implemented

- One Cloudflare Worker serves multiple crew sites.
- D1 resolves `request hostname -> site_id`.
- A platform subdomain and a custom domain can point at the same site.
- Each domain can render directly or redirect to the primary domain.
- The public page is server-rendered with title, description, canonical URL and Open Graph metadata from D1.
- Events, countdown, location, contact links, partners and photos are rendered from site data.
- `/calendar.ics`, `/api/site`, `/robots.txt`, `/sitemap.xml`, `/_health` and a domain-verification endpoint are included.
- The existing Innsbruck styling/assets remain the visual source during this slice via `asset_origin`.
- No runtime dependencies and no framework.

## Run locally

```bash
cd platform
export D1_DATABASE_ID=local-dev-id
npm run db:local
npm run dev
```

Use either hostname against the local Worker:

```bash
curl -H 'Host: innsbruck.stammtisch.test' http://localhost:8787/
curl -H 'Host: snowboardstammtisch.example' http://localhost:8787/
```

Both resolve to `site_id = innsbruck`; the custom domain is marked primary in `seed.example.sql`.

## Production bootstrap

1. Create one D1 database named `stammtisch-platform`.
2. Set `D1_DATABASE_ID` to its ID and run `npm run db:remote`.
3. Replace the `.test` and `.example` hostnames in a production seed with the real platform subdomain and real customer domain.
4. Route both hostnames to the Worker in Cloudflare.
5. Run `npm run deploy`.

The database mapping is the product truth. The Worker does not infer a tenant from arbitrary subdomain text; only active rows in `site_domains` resolve.

## Domain behavior

- `is_primary = 1`: canonical hostname for the site.
- `redirect_to_primary = 0`: render on the requested hostname but emit canonical metadata for the primary hostname.
- `redirect_to_primary = 1`: issue a permanent redirect to the primary hostname, preserving path and query.
- `status = pending`: hostname does not resolve until verified and activated.

## Next vertical slice

The next product increment is the owner editor/onboarding flow that creates `sites`, `site_domains`, events and branding without direct SQL. It should sit on top of this working resolver rather than replacing it.
