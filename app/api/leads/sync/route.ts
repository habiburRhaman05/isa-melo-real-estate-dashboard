import { NextResponse } from "next/server"

import { getApiUser } from "@/lib/auth"
import { syncLeadsFromGhl } from "@/lib/ghl-sync"
import { canManageLeads } from "@/lib/permissions"

export async function POST() {
  const { user, response } = await getApiUser()
  if (!user) return response

  if (!canManageLeads(user)) {
    return NextResponse.json({ error: "Only an admin can sync leads" }, { status: 403 })
  }

  const result = await syncLeadsFromGhl()
  if (!result.connected) {
    return NextResponse.json(
      { error: "GoHighLevel is not connected. Set GHL_PIT_TOKEN and GHL_LOCATION_ID." },
      { status: 503 },
    )
  }
  if (result.error) {
    return NextResponse.json({ error: result.error, ...result }, { status: 502 })
  }

  return NextResponse.json(result)
}
