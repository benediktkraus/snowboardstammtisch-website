import { buildCalendar } from "./ics.js";
import { createD1Repository } from "./repository.js";
import { renderCrewPage, renderUnknownDomain } from "./render.js";
import {
  absoluteUrl,
  compareIsoDate,
  localDateIso,
  normalizeHostname,
  responseHtml,
  responseJson,
  responseRedirect
} from "./utils.js";

function publicSite(site) {
  return {
    id: site.id,
    slug: site.slug,
    name: site.name,
    primaryHostname: site.primaryHostname,
    requestedHostname: site.requestedHostname,
    domainKind: site.domain.kind,
    seasonLabel: site.seasonLabel,
    timezone: site.timezone,
    location: site.location,
    events: site.events.map((event) => ({
      id: event.id,
      startsOn: event.starts_on,
      startsAt: event.starts_at,
      title: event.title,
      specialLabel: event.special_label,
      status: event.status
    }))
  };
}

function canonicalRedirect(site, requestUrl) {
  if (!site.domain.redirectToPrimary) return null;
  if (!site.primaryHostname || site.primaryHostname === site.requestedHostname) return null;
  return responseRedirect(absoluteUrl(site.primaryHostname, `${requestUrl.pathname}${requestUrl.search}`));
}

function cspOrigin(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value));
    return ["https:", "http:"].includes(url.protocol) ? url.origin : "";
  } catch {
    return "";
  }
}

function securityHeaders(env, site = null) {
  const assetOrigins = new Set([
    cspOrigin(env.ASSET_ORIGIN),
    cspOrigin(site?.assetOrigin)
  ].filter(Boolean));
  const imageSources = ["'self'", "data:", "https:"].join(" ");
  const styleSources = [
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
    ...assetOrigins
  ].join(" ");
  return {
    "content-security-policy": `default-src 'self'; img-src ${imageSources}; style-src ${styleSources}; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "x-frame-options": "DENY"
  };
}

export function createHandler({ repositoryFactory = createD1Repository, now = () => new Date() } = {}) {
  return {
    async fetch(request, env = {}, ctx = {}) {
      const url = new URL(request.url);
      const hostname = normalizeHostname(url.hostname || request.headers.get("host"));

      if (url.pathname === "/_health") {
        return responseJson({ ok: true, service: "stammtisch-platform", hostname });
      }

      if (url.pathname === "/.well-known/stammtisch-domain") {
        return responseJson({
          service: "stammtisch-platform",
          hostname,
          token: env.DOMAIN_VERIFICATION_TOKEN || null
        });
      }

      let repository;
      try {
        repository = repositoryFactory(env);
      } catch (error) {
        return responseJson({ ok: false, error: "repository_unavailable", detail: String(error.message || error) }, 503);
      }

      let site;
      try {
        site = await repository.getSiteByHostname(hostname);
      } catch (error) {
        console.error("site resolution failed", { hostname, error: String(error?.stack || error) });
        return responseJson({ ok: false, error: "site_resolution_failed" }, 500);
      }

      if (!site) {
        return responseHtml(renderUnknownDomain(hostname), 404, securityHeaders(env));
      }

      const redirect = canonicalRedirect(site, url);
      if (redirect) return redirect;

      if (url.pathname === "/api/site") {
        return responseJson(publicSite(site), 200, { "access-control-allow-origin": "*" });
      }

      if (url.pathname === "/calendar.ics") {
        const today = localDateIso(now(), site.timezone);
        const upcoming = site.events.filter((event) => event.status !== "cancelled" && compareIsoDate(event.starts_on, today) >= 0);
        const calendar = buildCalendar(site, upcoming.length ? upcoming : site.events.filter((event) => event.status !== "cancelled"), now());
        return new Response(calendar, {
          headers: {
            "content-type": "text/calendar; charset=utf-8",
            "content-disposition": `attachment; filename="${site.slug || "stammtisch"}.ics"`,
            "cache-control": "public, max-age=300"
          }
        });
      }

      if (url.pathname === "/robots.txt") {
        return new Response(`User-agent: *\nAllow: /\nSitemap: https://${site.primaryHostname}/sitemap.xml\n`, {
          headers: { "content-type": "text/plain; charset=utf-8" }
        });
      }

      if (url.pathname === "/sitemap.xml") {
        const canonical = `https://${site.primaryHostname}/`;
        return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${canonical}</loc></url></urlset>`, {
          headers: { "content-type": "application/xml; charset=utf-8" }
        });
      }

      if (url.pathname !== "/") {
        return responseHtml(renderUnknownDomain(hostname), 404, securityHeaders(env, site));
      }

      const html = renderCrewPage(site, url, now());
      const response = responseHtml(html, 200, securityHeaders(env, site));
      if (ctx?.waitUntil && env?.CACHE_PURGE_PROMISE) ctx.waitUntil(env.CACHE_PURGE_PROMISE);
      return response;
    }
  };
}

export default createHandler();
