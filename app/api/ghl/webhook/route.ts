import { NextResponse } from "next/server"

import { env } from "@/env.mjs"
import { handleGhlWebhook } from "@/lib/ghl-sync"

export const dynamic = "force-dynamic"

/* Inbound half of the two-way sync: point a GHL webhook (or a workflow Custom
   Webhook action) at /api/ghl/webhook?secret=... and contact/opportunity
   changes are mirrored immediately. The page-load pull sync covers anything a
   webhook misses. */
export async function POST(request: Request) {
  const secret = env.GHL_WEBHOOK_SECRET
  if (secret) {
    const url = new URL(request.url)
    const provided = url.searchParams.get("secret") ?? request.headers.get("x-ghl-webhook-secret")
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    payload = null
  }

  /* Always acknowledge: GHL retries non-2xx responses twelve times. */
  try {
    const result = await handleGhlWebhook(payload)
    return NextResponse.json({ ok: true, result })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
