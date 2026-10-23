import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { getApiUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { findUserById, getLeadWithRelations } from "@/lib/db/queries"
import { leadActivities, leads } from "@/lib/db/schema"
import { getLeadPipeline } from "@/lib/ghl-pipeline"
import { syncLeadToGhl } from "@/lib/ghl-sync"
import { isClosedStage, stageInfo } from "@/lib/leads"
import { canManageLeads } from "@/lib/permissions"
import { isUuid, leadUpdateSchema } from "@/lib/validators"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { user, response } = await getApiUser()
  if (!user) return response

  if (!canManageLeads(user)) {
    return NextResponse.json({ error: "Only an admin can edit leads" }, { status: 403 })
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

  const parsed = leadUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid update" }, { status: 400 })
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ lead })
  }

  const { value, stage, ...rest } = parsed.data
  const updates: Record<string, unknown> = { ...rest }

  if (rest.assigneeId) {
    const assignee = await findUserById(rest.assigneeId)
    if (!assignee) {
      return NextResponse.json({ error: "Assignee not found" }, { status: 400 })
    }
  }

  const pipeline = await getLeadPipeline()

  if (value !== undefined) {
    updates.value = String(value)
  }

  if (stage !== undefined && stage !== lead.stage) {
    /* a stage id that isn't in the mirrored pipeline would make the lead
       vanish from every column, so reject it instead of storing it */
    if (!pipeline.stages.some((item) => item.id === stage)) {
      return NextResponse.json({ error: "Unknown pipeline stage" }, { status: 400 })
    }

    updates.stage = stage
    /* mirrors the prototype's setStage(): closing a lead stamps closedAt,
       moving it back open clears it */
    updates.closedAt = isClosedStage(stage, pipeline.stages) ? new Date() : null

    await db.insert(leadActivities).values({
      leadId: id,
      type: "stage",
      authorId: user.id,
      authorName: user.name,
      text: `${stageInfo(lead.stage, pipeline.stages).name} → ${stageInfo(stage, pipeline.stages).name}`,
    })
  }

  if (Object.keys(updates).length > 0) {
    await db.update(leads).set(updates).where(eq(leads.id, id))
  }

  let updated = await getLeadWithRelations(id)
  const sync = updated ? await syncLeadToGhl(updated) : { skipped: true }
  /* syncLeadToGhl persists the GHL ids it created, so re-read to return them */
  if (!sync.skipped && (sync.contactId || sync.opportunityId)) {
    updated = await getLeadWithRelations(id)
  }

  return NextResponse.json({ lead: updated, sync })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { user, response } = await getApiUser()
  if (!user) return response

  if (!canManageLeads(user)) {
    return NextResponse.json({ error: "Only an admin can delete leads" }, { status: 403 })
  }

  const { id } = await params
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  }
  const lead = await getLeadWithRelations(id)
  if (!lead || lead.deletedAt) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  }

  await db.update(leads).set({ deletedAt: new Date() }).where(eq(leads.id, id))
  return NextResponse.json({ ok: true })
}
