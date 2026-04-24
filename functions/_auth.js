// JWT + PBKDF2 auth utilities for Pages Functions
// No external deps — uses Web Crypto API only

const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

// --- PBKDF2 password hashing ---

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial, KEY_BYTES * 8
  );
  return b64encode(salt) + ":" + b64encode(new Uint8Array(bits));
}

export async function verifyPassword(password, stored) {
  const [saltB64, hashB64] = stored.split(":");
  if (!saltB64 || !hashB64) return false;
  const salt = b64decode(saltB64);
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial, KEY_BYTES * 8
  );
  return b64encode(new Uint8Array(bits)) === hashB64;
}

// --- JWT (HMAC-SHA256) ---

export async function createJWT(secret) {
  const header = b64url({ alg: "HS256", typ: "JWT" });
  const payload = b64url({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 });
  const sig = await hmacSign(secret, header + "." + payload);
  return header + "." + payload + "." + sig;
}

export async function verifyJWT(token, secret) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const sig = await hmacSign(secret, parts[0] + "." + parts[1]);
  if (sig !== parts[2]) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp > Date.now() / 1000;
  } catch { return false; }
}

async function hmacSign(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64encode(new Uint8Array(sig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// --- Cookie parsing ---

export function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

// --- JWT secret management ---
// Stored in KV, auto-generated on first use. No external config needed.

export async function getJWTSecret(env) {
  let secret = env.JWT_SECRET; // try Pages secret first
  if (secret) return secret;
  // Fallback: KV-stored secret
  secret = await env.SBI.get("jwt:secret");
  if (secret) return secret;
  // Auto-generate and store
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  secret = b64encode(bytes);
  await env.SBI.put("jwt:secret", secret);
  return secret;
}

// --- Auth middleware helper ---

export async function requireAuth(request, env) {
  const token = getCookie(request, "sbi-admin");
  const secret = await getJWTSecret(env);
  if (!await verifyJWT(token, secret)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  return null; // authenticated
}

// --- Base64 helpers ---

function b64encode(buf) {
  let binary = "";
  for (const byte of buf) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function b64decode(str) {
  const binary = atob(str);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf;
}

function b64url(obj) {
  return btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// --- JSON response helper ---

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}
