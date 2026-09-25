import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as accountsAndCourses from "./schema";
import * as materialSchema from "./material-schema";

const schema = { ...accountsAndCourses, ...materialSchema };

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Configure the existing D1 database binding in wrangler.json before using the database.",
    );
  }

  return drizzle(env.DB, { schema });
}
