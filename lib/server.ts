type D1Result<T = Record<string, unknown>> = { results?: T[]; success?: boolean };
type D1Statement = { bind: (...values: unknown[]) => D1Statement; first: <T = Record<string, unknown>>() => Promise<T | null>; run: () => Promise<unknown>; all: <T = Record<string, unknown>>() => Promise<D1Result<T>> };
type D1 = { prepare: (sql: string) => D1Statement; batch: (statements: D1Statement[]) => Promise<unknown> };
type Bucket = { put: (key: string, value: ArrayBuffer, options?: unknown) => Promise<unknown>; get: (key: string) => Promise<{ arrayBuffer: () => Promise<ArrayBuffer> } | null> };
type RuntimeEnv = { DB?: D1; BUCKET?: Bucket; GEMINI_API_KEYS?: string; GEMINI_API_KEY?: string; GEMINI_MODEL?: string; GROQ_API_KEYS?: string; GROQ_API_KEY?: string; GROQ_MODEL?: string };

let runtimePromise: Promise<RuntimeEnv> | null = null;
async function getRuntime() {
  runtimePromise ||= import("cloudflare:workers").then((module) => module.env as unknown as RuntimeEnv);
  return runtimePromise;
}
const SESSION_COOKIE = "neev_session";
const DAY = 86_400_000;

export async function getDb() { const runtime = await getRuntime(); if (!runtime.DB) throw new Error("Persistent database is not configured"); return runtime.DB; }
export async function getBucket() { const runtime = await getRuntime(); if (!runtime.BUCKET) throw new Error("Document storage is not configured"); return runtime.BUCKET; }

export async function ensureSchema() {
  const db = await getDb();
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, password_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL, expires_at INTEGER NOT NULL, FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE)"),
    db.prepare("CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, service TEXT NOT NULL, state TEXT NOT NULL DEFAULT '', district TEXT NOT NULL DEFAULT '', language TEXT NOT NULL DEFAULT 'en', status TEXT NOT NULL, step INTEGER NOT NULL DEFAULT 0, profile_json TEXT NOT NULL DEFAULT '{}', plan_json TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE)"),
    db.prepare("CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, case_id TEXT NOT NULL, type TEXT NOT NULL, file_name TEXT NOT NULL, object_key TEXT NOT NULL, mime_type TEXT NOT NULL, size INTEGER NOT NULL, status TEXT NOT NULL, confidence INTEGER NOT NULL DEFAULT 0, extracted_json TEXT NOT NULL DEFAULT '{}', issue TEXT, created_at INTEGER NOT NULL, FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE)"),
    db.prepare("CREATE INDEX IF NOT EXISTS cases_account_idx ON cases(account_id, updated_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS documents_case_idx ON documents(case_id, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at)"),
  ]);
}

function bytesToHex(bytes: Uint8Array) { return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
function hexToBytes(hex: string) { return new Uint8Array(hex.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) || []); }
export function randomToken(bytes = 32) { const value = new Uint8Array(bytes); crypto.getRandomValues(value); return bytesToHex(value); }
export async function sha256(value: string) { return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))); }
export async function hashPassword(password: string, saltHex: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: hexToBytes(saltHex), iterations: 100_000, hash: "SHA-256" }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}
export function constantTimeEqual(a: string, b: string) { if (a.length !== b.length) return false; let value = 0; for (let i = 0; i < a.length; i++) value |= a.charCodeAt(i) ^ b.charCodeAt(i); return value === 0; }

export async function createSession(accountId: string) {
  const token = randomToken(); const tokenHash = await sha256(token); const expiresAt = Date.now() + 30 * DAY;
  await (await getDb()).prepare("INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)").bind(tokenHash, accountId, expiresAt).run();
  return { token, cookie: `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 86400}` };
}
export async function sessionAccount(request: Request) {
  await ensureSchema(); const cookie = request.headers.get("cookie") || ""; const token = cookie.split(/;\s*/).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.split("=")[1]; if (!token) return null;
  const row = await (await getDb()).prepare("SELECT account_id AS accountId FROM sessions WHERE token_hash = ? AND expires_at > ?").bind(await sha256(token), Date.now()).first<{ accountId: string }>(); return row?.accountId || null;
}
export async function requireAccount(request: Request) { const accountId = await sessionAccount(request); if (!accountId) throw new Response(JSON.stringify({ error: "Please sign in to continue" }), { status: 401, headers: { "Content-Type": "application/json" } }); return accountId; }
export function clearSessionCookie() { return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }

export function json(data: unknown, status = 200, headers?: HeadersInit) { return Response.json({ data }, { status, headers }); }
export function errorResponse(error: unknown) { if (error instanceof Response) return error; const message = error instanceof Error ? error.message : "Unexpected error"; return Response.json({ error: message }, { status: 500 }); }
export function safeJson<T>(value: string | null | undefined, fallback: T): T { try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } }

function splitKeys(...values: (string | undefined)[]) { return values.flatMap((value) => (value || "").split(",")).map((key) => key.trim()).filter(Boolean); }
function stripJson(text: string) { return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim(); }
function toBase64(buffer: ArrayBuffer) { const bytes = new Uint8Array(buffer); let binary = ""; for (let start = 0; start < bytes.length; start += 0x8000) binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000)); return btoa(binary); }

export async function runAI<T>({ prompt, image, mimeType, fallback }: { prompt: string; image?: ArrayBuffer; mimeType?: string; fallback?: T }): Promise<T> {
  const runtime = await getRuntime();
  const geminiKeys = splitKeys(runtime.GEMINI_API_KEYS, runtime.GEMINI_API_KEY); let lastError: unknown;
  for (const key of geminiKeys) try {
    const parts: Record<string, unknown>[] = [{ text: prompt }]; if (image) parts.push({ inline_data: { mime_type: mimeType || "image/jpeg", data: toBase64(image) } });
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${runtime.GEMINI_MODEL || "gemini-2.5-flash-lite"}:generateContent?key=${key}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.1 } }) });
    if (!response.ok) { lastError = new Error(`Gemini ${response.status}`); if ([401, 403, 429].includes(response.status)) continue; throw lastError; }
    const body = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }; const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || ""; return JSON.parse(stripJson(text)) as T;
  } catch (error) { lastError = error; }

  const groqKeys = splitKeys(runtime.GROQ_API_KEYS, runtime.GROQ_API_KEY);
  for (const key of groqKeys) try {
    const content: unknown = image ? [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:${mimeType || "image/jpeg"};base64,${toBase64(image)}` } }] : prompt;
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: runtime.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct", messages: [{ role: "system", content: "Return one valid JSON object and no markdown." }, { role: "user", content }], temperature: 0.1, response_format: { type: "json_object" } }) });
    if (!response.ok) { lastError = new Error(`Groq ${response.status}`); if ([401, 403, 429].includes(response.status)) continue; throw lastError; }
    const body = await response.json() as { choices?: { message?: { content?: string } }[] }; return JSON.parse(stripJson(body.choices?.[0]?.message?.content || "{}")) as T;
  } catch (error) { lastError = error; }
  if (fallback !== undefined) return fallback; throw lastError || new Error("No AI key is configured. Add GEMINI_API_KEYS or GROQ_API_KEYS.");
}
