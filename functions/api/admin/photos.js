// POST /api/admin/photos — upload photo
// DELETE /api/admin/photos?key=photo:DATE:N — delete photo
// Auth required for both
import { requireAuth, json } from "../../_auth.js";

export async function onRequestPost(context) {
  const denied = await requireAuth(context.request, context.env);
  if (denied) return denied;

  let formData;
  try { formData = await context.request.formData(); } catch {
    return json({ error: "multipart form data required" }, 400);
  }
  const date = formData.get("date");
  const file = formData.get("file");
  if (!date || !file) return json({ error: "date and file required" }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "invalid date format" }, 400);

  // Read photo index for this date
  const indexKey = `photos:${date}`;
  const existing = await context.env.SBI.get(indexKey);
  const index = existing ? JSON.parse(existing) : [];
  const nextIdx = index.length;
  const photoKey = `photo:${date}:${nextIdx}`;

  // Store binary
  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength > 2 * 1024 * 1024) {
    return json({ error: "file too large (max 2MB, compress client-side)" }, 400);
  }
  await context.env.SBI.put(photoKey, arrayBuffer);

  // Update index
  index.push(photoKey);
  await context.env.SBI.put(indexKey, JSON.stringify(index));

  return json({ ok: true, key: photoKey, count: index.length });
}

export async function onRequestDelete(context) {
  const denied = await requireAuth(context.request, context.env);
  if (denied) return denied;

  const url = new URL(context.request.url);
  const key = url.searchParams.get("key");
  if (!key || !key.startsWith("photo:")) return json({ error: "invalid key" }, 400);

  // Delete binary
  await context.env.SBI.delete(key);

  // Update index: extract date from key "photo:DATE:N"
  const parts = key.split(":");
  if (parts.length === 3) {
    const date = parts[1];
    const indexKey = `photos:${date}`;
    const existing = await context.env.SBI.get(indexKey);
    if (existing) {
      const index = JSON.parse(existing).filter(k => k !== key);
      if (index.length > 0) {
        await context.env.SBI.put(indexKey, JSON.stringify(index));
      } else {
        await context.env.SBI.delete(indexKey);
      }
    }
  }

  return json({ ok: true });
}
