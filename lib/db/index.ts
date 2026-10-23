import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and add your Postgres connection URL."
  )
}

/* keep a single connection pool across Next.js dev hot reloads */
const globalForDb = globalThis as unknown as { postgresClient?: ReturnType<typeof postgres> }

/* Neon closes idle server-side connections on its own. Retiring ours first
   (idle_timeout < their window) avoids handing a dead socket to the next
   query, which surfaces as an ETIMEDOUT on an otherwise healthy app. */
const client =
  globalForDb.postgresClient ??
  postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 15,
    max_lifetime: 60 * 30,
  })

if (process.env.NODE_ENV !== "production") {
  globalForDb.postgresClient = client
}

export const db = drizzle(client, { schema })
