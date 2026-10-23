import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  server: {
    ANALYZE: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
    DATABASE_URL: z.string().optional(),
    GHL_PIT_TOKEN: z.string().optional(),
    GHL_LOCATION_ID: z.string().optional(),
    GHL_PIPELINE_NAME: z.string().optional(),
    GHL_WEBHOOK_SECRET: z.string().optional(),
  },
  client: {},
  runtimeEnv: {
    ANALYZE: process.env.ANALYZE,
    DATABASE_URL: process.env.DATABASE_URL,
    GHL_PIT_TOKEN: process.env.GHL_PIT_TOKEN,
    GHL_LOCATION_ID: process.env.GHL_LOCATION_ID,
    GHL_PIPELINE_NAME: process.env.GHL_PIPELINE_NAME,
    GHL_WEBHOOK_SECRET: process.env.GHL_WEBHOOK_SECRET,
  },
})
