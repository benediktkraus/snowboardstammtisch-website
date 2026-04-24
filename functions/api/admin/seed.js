// POST /api/admin/seed — migrate static JSON files to KV (one-time)
import { requireAuth, json } from "../../_auth.js";

export async function onRequestPost(context) {
  const denied = await requireAuth(context.request, context.env);
  if (denied) return denied;

  const existingConfig = await context.env.SBI.get("config");
  const existingDates = await context.env.SBI.get("dates");
  if (existingConfig && existingDates) {
    return json({ ok: false, message: "already seeded" });
  }

  const baseUrl = new URL(context.request.url).origin;
  const results = {};

  if (!existingConfig) {
    const cfgRes = await fetch(`${baseUrl}/content/config.json`);
    if (cfgRes.ok) {
      const cfg = await cfgRes.text();
      await context.env.SBI.put("config", cfg);
      results.config = "seeded";
    } else {
      results.config = "static file not found";
    }
  } else {
    results.config = "already exists";
  }

  if (!existingDates) {
    const datesRes = await fetch(`${baseUrl}/content/dates.json`);
    if (datesRes.ok) {
      const dates = await datesRes.text();
      await context.env.SBI.put("dates", dates);
      results.dates = "seeded";
    } else {
      results.dates = "static file not found";
    }
  } else {
    results.dates = "already exists";
  }

  return json({ ok: true, results });
}
