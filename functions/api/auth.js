// POST /api/auth — login with password, returns JWT cookie
import { verifyPassword, createJWT, getJWTSecret, json } from "../_auth.js";

export async function onRequestPost(context) {
  let body;
  try { body = await context.request.json(); } catch {
    return json({ error: "invalid json" }, 400);
  }
  const { password } = body;
  if (!password) return json({ error: "password required" }, 400);

  const stored = await context.env.SBI.get("admin:passwordHash");
  if (!stored) return json({ error: "no password set, use /api/setup first" }, 403);

  const valid = await verifyPassword(password, stored);
  if (!valid) return json({ error: "wrong password" }, 401);

  const secret = await getJWTSecret(context.env);
  const token = await createJWT(secret);
  return json({ ok: true }, 200, {
    "Set-Cookie": `sbi-admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
  });
}
