// GET /api/photos/serve?key=photo:2024-11-21:0 — serve photo binary
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const key = url.searchParams.get("key");
  if (!key || !key.startsWith("photo:")) {
    return new Response("invalid key", { status: 400 });
  }
  const data = await context.env.SBI.get(key, "arrayBuffer");
  if (!data) return new Response("not found", { status: 404 });
  return new Response(data, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400"
    }
  });
}
