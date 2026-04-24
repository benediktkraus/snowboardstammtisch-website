// GET /api/content?type=config|dates — public endpoint
// Reads from KV, falls back to static files
import { json } from "../_auth.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const type = url.searchParams.get("type");
  if (type !== "config" && type !== "dates") {
    return json({ error: "type must be config or dates" }, 400);
  }
  const data = await context.env.SBI.get(type);
  if (data) {
    return new Response(data, {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" }
    });
  }
  // KV empty — fall through to static file
  const staticUrl = new URL(`/content/${type}.json`, context.request.url);
  const staticResponse = await fetch(staticUrl.toString());
  if (staticResponse.ok) return staticResponse;
  return json({ error: "not found" }, 404);
}
