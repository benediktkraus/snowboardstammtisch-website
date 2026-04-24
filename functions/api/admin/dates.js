// GET/PUT /api/admin/dates — read/write dates (auth required)
import { requireAuth, json } from "../../_auth.js";

export async function onRequestGet(context) {
  const denied = await requireAuth(context.request, context.env);
  if (denied) return denied;
  const data = await context.env.SBI.get("dates");
  if (!data) return json({ error: "not found, run seed first" }, 404);
  return new Response(data, { headers: { "Content-Type": "application/json" } });
}

export async function onRequestPut(context) {
  const denied = await requireAuth(context.request, context.env);
  if (denied) return denied;
  let body;
  try { body = await context.request.json(); } catch {
    return json({ error: "invalid json" }, 400);
  }
  if (!Array.isArray(body.seasons) || body.seasons.length === 0) {
    return json({ error: "seasons array required" }, 400);
  }
  const currentCount = body.seasons.filter(s => s.current).length;
  if (currentCount !== 1) {
    return json({ error: "exactly one season must be current" }, 400);
  }
  for (const s of body.seasons) {
    if (!s.label || !Array.isArray(s.dates)) {
      return json({ error: "each season needs label and dates array" }, 400);
    }
  }
  await context.env.SBI.put("dates", JSON.stringify(body));
  return json({ ok: true });
}
