// Global middleware: CORS for API routes
export async function onRequest(context) {
  const origin = context.request.headers.get("Origin");
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400"
      }
    });
  }
  const response = await context.next();
  const newResponse = new Response(response.body, response);
  if (origin) newResponse.headers.set("Access-Control-Allow-Origin", origin);
  newResponse.headers.set("Access-Control-Allow-Credentials", "true");
  return newResponse;
}
