import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getHistoryDb(): D1Database | undefined {
  return env.DB;
}

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Configure DB in cloudflare.deploy.json for Cloudflare, or d1 in .openai/hosting.json for Sites."
    );
  }

  return drizzle(env.DB, { schema });
}
