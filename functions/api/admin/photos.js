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
  const isFlyer = date === "flyer";
  if (!isFlyer && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "invalid date format" }, 400);

  // Read photo index for this date
  const MAX_PHOTOS = isFlyer ? 1 : 20;
  const indexKey = `photos:${date}`;
  const existing = await context.env.SBI.get(indexKey);
  const index = existing ? JSON.parse(existing) : [];
  if (!isFlyer && index.length >= MAX_PHOTOS) {
    return json({ error: `max ${MAX_PHOTOS} ${isFlyer ? "Flyer" : "Fotos pro Termin"}` }, 400);
  }
  const nextIdx = index.length === 0 ? 0 : Math.max(...index.map(k => parseInt(k.split(":")[2]))) + 1;
  const photoKey = isFlyer && index.length ? index[0] : `photo:${date}:${nextIdx}`;

  // Store binary
  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength > 2 * 1024 * 1024) {
    return json({ error: "file too large (max 2MB, compress client-side)" }, 400);
  }
  await context.env.SBI.put(photoKey, arrayBuffer);

  // Update index
  if (!index.includes(photoKey)) index.push(photoKey);
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

export async function onRequestPut(context) {
  const denied = await requireAuth(context.request, context.env);
  if (denied) return denied;

  let data;
  try { data = await context.request.json(); } catch {
    return json({ error: "json body required" }, 400);
  }
  if (data?.date !== "flyer" || typeof data.enabled !== "boolean") {
    return json({ error: "date flyer and boolean enabled required" }, 400);
  }
  await context.env.SBI.put("flyer:enabled", data.enabled ? "true" : "false");
  return json({ ok: true, enabled: data.enabled });
}
