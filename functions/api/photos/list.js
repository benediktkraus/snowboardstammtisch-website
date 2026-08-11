// GET /api/photos/list?date=2024-11-21 — public photo index
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const date = url.searchParams.get("date");
  if (!date) {
    return new Response(JSON.stringify({ error: "date parameter required" }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });
  }
  const data = await context.env.SBI.get(`photos:${date}`);
  if (date === "flyer" && url.searchParams.get("meta") === "1") {
    const enabled = await context.env.SBI.get("flyer:enabled");
    return new Response(JSON.stringify({ keys: JSON.parse(data || "[]"), enabled: enabled === "true" }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }
  return new Response(data || "[]", {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" }
  });
}
