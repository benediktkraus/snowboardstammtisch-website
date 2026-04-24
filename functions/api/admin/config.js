// GET/PUT /api/admin/config — read/write config (auth required)
import { requireAuth, json } from "../../_auth.js";

export async function onRequestGet(context) {
  const denied = await requireAuth(context.request, context.env);
  if (denied) return denied;
  const data = await context.env.SBI.get("config");
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
  if (!body.location || !body.intro || !body.partners) {
    return json({ error: "missing required fields: location, intro, partners" }, 400);
  }
  await context.env.SBI.put("config", JSON.stringify(body));
  return json({ ok: true });
}
