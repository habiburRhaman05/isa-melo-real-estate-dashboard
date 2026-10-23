import { NextResponse } from "next/server"

import { getApiUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { findUserById, getLeads, getLeadWithRelations } from "@/lib/db/queries"
import { leadActivities, leads } from "@/lib/db/schema"
import { getLeadPipeline } from "@/lib/ghl-pipeline"
import { syncLeadToGhl } from "@/lib/ghl-sync"
import { isClosedStage } from "@/lib/leads"
import { canManageLeads } from "@/lib/permissions"
import { leadCreateSchema } from "@/lib/validators"

export async function GET() {
  const { user, response } = await getApiUser()
  if (!user) return response

  if (!canManageLeads(user)) {
    return NextResponse.json({ error: "Only an admin can view website leads" }, { status: 403 })
  }

  const allLeads = await getLeads()
  return NextResponse.json({ leads: allLeads })
}

export async function POST(request: Request) {
  const { user, response } = await getApiUser()
  if (!user) return response

  if (!canManageLeads(user)) {
    return NextResponse.json({ error: "Only an admin can add leads" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = leadCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid lead" }, { status: 400 })
  }

  const data = parsed.data

  if (data.assigneeId) {
    const assignee = await findUserById(data.assigneeId)
    if (!assignee) {
      return NextResponse.json({ error: "Assignee not found" }, { status: 400 })
    }
  }

  const pipeline = await getLeadPipeline()
  const stage =
    data.stage && pipeline.stages.some((item) => item.id === data.stage)
      ? data.stage
      : (pipeline.stages[0]?.id ?? data.stage ?? "new")

  const [created] = await db
    .insert(leads)
    .values({
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email,
      business: data.business,
      info: data.info,
      address: data.address,
      country: data.country,
      professional: data.professional,
      value: String(data.value),
      source: data.source,
      message: data.message,
      stage,
      assigneeId: data.assigneeId,
      followUp: data.followUp,
      closedAt: isClosedStage(stage, pipeline.stages) ? new Date() : null,
    })
    .returning()

  if (!created) {
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 })
  }

  await db.insert(leadActivities).values({
    leadId: created.id,
    type: "created",
    authorId: user.id,
    authorName: user.name,
    text: "Lead added manually",
  })

  const sync = await syncLeadToGhl(created)
  const lead = await getLeadWithRelations(created.id)
  return NextResponse.json({ lead, sync }, { status: 201 })
}
