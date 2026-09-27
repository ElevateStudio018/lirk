import { createHmac, randomUUID } from "node:crypto";
import http from "node:http";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import type { Database } from "@/lib/supabase/database.types";
import type { DB } from "@/lib/supabase/server";

const POSTGREST = process.env.E2E_POSTGREST!;
const SECRET = process.env.E2E_JWT_SECRET!;

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/** HS256 JWT exactly like Supabase Auth issues for a signed-in user. */
export function signJwt(sub: string) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ sub, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 }));
  const sig = b64url(createHmac("sha256", SECRET).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

/** supabase-js talks to <url>/rest/v1 – this tiny proxy maps that onto PostgREST. */
export async function startRestProxy(): Promise<{ url: string; close: () => void }> {
  const target = new URL(POSTGREST);
  const server = http.createServer((req, res) => {
    const path = (req.url ?? "/").replace(/^\/rest\/v1/, "");
    const upstream = http.request(
      { hostname: target.hostname, port: target.port, path, method: req.method, headers: { ...req.headers, host: target.host } },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as { port: number };
  return { url: `http://127.0.0.1:${port}`, close: () => server.close() };
}

export async function withPg<T>(fn: (c: Client) => Promise<T>) {
  const c = new Client({ database: process.env.E2E_DB });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

export async function createUser(email = `${randomUUID()}@example.com`) {
  const id = randomUUID();
  await withPg((c) => c.query("insert into auth.users (id, email) values ($1, $2)", [id, email]));
  return id;
}

/** A Supabase client acting as the given user – every query goes through RLS. */
export function clientFor(url: string, userId: string): DB {
  const token = signJwt(userId);
  return createClient<Database>(url, "anon-key-not-used", {
    accessToken: async () => token,
  }) as unknown as DB;
}
