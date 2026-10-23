import { NextResponse } from "next/server"

import { getApiUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { getLeadWithRelations } from "@/lib/db/queries"
import { leadActivities } from "@/lib/db/schema"
import { canManageLeads } from "@/lib/permissions"
import { isUuid, leadActivityCreateSchema } from "@/lib/validators"

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const { user, response } = await getApiUser()
  if (!user) return response

  if (!canManageLeads(user)) {
    return NextResponse.json({ error: "Only an admin can log activity on a lead" }, { status: 403 })
  }

  const { id } = await params
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  }
  const lead = await getLeadWithRelations(id)
  if (!lead || lead.deletedAt) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = leadActivityCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid activity" }, { status: 400 })
  }

  await db.insert(leadActivities).values({
    leadId: id,
    type: parsed.data.type,
    authorId: user.id,
    authorName: user.name,
    text: parsed.data.text,
  })

  const updated = await getLeadWithRelations(id)
  return NextResponse.json({ lead: updated }, { status: 201 })
}
