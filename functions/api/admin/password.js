// PUT /api/admin/password — change admin password
import { requireAuth, verifyPassword, hashPassword, json } from "../../_auth.js";

export async function onRequestPut(context) {
  const denied = await requireAuth(context.request, context.env);
  if (denied) return denied;

  let body;
  try { body = await context.request.json(); } catch {
    return json({ error: "invalid json" }, 400);
  }
  const { current, password } = body;
  if (!current || !password) return json({ error: "current and password required" }, 400);
  if (password.length < 6) return json({ error: "password must be at least 6 characters" }, 400);

  const stored = await context.env.SBI.get("admin:passwordHash");
  if (!stored || !await verifyPassword(current, stored)) {
    return json({ error: "current password wrong" }, 401);
  }

  const hash = await hashPassword(password);
  await context.env.SBI.put("admin:passwordHash", hash);
  return json({ ok: true });
}
