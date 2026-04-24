// POST /api/setup — one-time initial password setup
// Only works if no password hash exists yet in KV
import { hashPassword, json } from "../_auth.js";

export async function onRequestPost(context) {
  const existing = await context.env.SBI.get("admin:passwordHash");
  if (existing) return json({ error: "password already set" }, 403);

  let body;
  try { body = await context.request.json(); } catch {
    return json({ error: "invalid json" }, 400);
  }
  const { password } = body;
  if (!password || password.length < 6) {
    return json({ error: "password must be at least 6 characters" }, 400);
  }

  const hash = await hashPassword(password);
  await context.env.SBI.put("admin:passwordHash", hash);
  return json({ ok: true });
}

// GET /api/setup — check if setup is needed
export async function onRequestGet(context) {
  const existing = await context.env.SBI.get("admin:passwordHash");
  return json({ needsSetup: !existing });
}
