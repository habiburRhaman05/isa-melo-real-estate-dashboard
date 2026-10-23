import { NextResponse } from "next/server"

import { getApiUser } from "@/lib/auth"
import { CREDIT_RATE_KEY, getCreditRate, setSetting } from "@/lib/db/queries"
import { canManageMembers } from "@/lib/permissions"
import { settingsUpdateSchema } from "@/lib/validators"

export async function GET() {
  const { user, response } = await getApiUser()
  if (!user) return response

  return NextResponse.json({ settings: { creditRate: await getCreditRate() } })
}

export async function PATCH(request: Request) {
  const { user, response } = await getApiUser()
  if (!user) return response

  if (!canManageMembers(user)) {
    return NextResponse.json({ error: "Only an admin can change settings" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = settingsUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" }, { status: 400 })
  }

  if (parsed.data.creditRate !== undefined) {
    await setSetting(CREDIT_RATE_KEY, parsed.data.creditRate, user.id)
  }

  return NextResponse.json({ settings: { creditRate: await getCreditRate() } })
}
