import { defineConfig } from "drizzle-kit"

import { loadEnvFile } from "./lib/load-env"

loadEnvFile()

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
})
