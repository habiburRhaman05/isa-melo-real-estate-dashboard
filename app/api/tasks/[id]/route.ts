import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { getTaskWithRelations } from "@/lib/db/queries"
import { taskAssignees, tasks } from "@/lib/db/schema"
import {
  canAccessTask,
  canDeleteTask,
  canMoveToStage,
  canSetAssignees,
  canSetRevision,
  canSetSubmissionLink,
} from "@/lib/permissions"
import { isUuid, taskUpdateSchema } from "@/lib/validators"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }
  const task = await getTaskWithRelations(id)
  if (!task || task.deletedAt) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  if (!canAccessTask(user, task)) {
    return NextResponse.json({ error: "You can only edit tasks assigned to you" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = taskUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid update" }, { status: 400 })
  }

  const { assigneeIds, stage, revision, cost, link, ...rest } = parsed.data
  const updates: Record<string, unknown> = { ...rest }

  /* Only the team fills in the submission link; admins can open it but not
     change it, so reject the write instead of silently dropping it. */
  if (link !== undefined && link !== task.link) {
    if (!canSetSubmissionLink(user)) {
      return NextResponse.json(
        { error: "The submission link is set by the team, not by an admin" },
        { status: 403 },
      )
    }
    updates.link = link
  }

  if (stage !== undefined) {
    if (!canMoveToStage(user, task, stage)) {
      return NextResponse.json({ error: "Only an admin can move a task to that stage" }, { status: 403 })
    }
    updates.stage = stage
  }

  if (revision !== undefined) {
    if (!canSetRevision(user)) {
      return NextResponse.json({ error: "Only an admin can set a revision request" }, { status: 403 })
    }
    updates.revision = revision
  }

  if (cost !== undefined) {
    updates.cost = String(cost)
  }

  if (Object.keys(updates).length > 0) {
    await db.update(tasks).set(updates).where(eq(tasks.id, id))
  }

  if (assigneeIds !== undefined) {
    if (!canSetAssignees(user)) {
      return NextResponse.json({ error: "Only an admin can change assignees" }, { status: 403 })
    }
    await db.delete(taskAssignees).where(eq(taskAssignees.taskId, id))
    if (assigneeIds.length > 0) {
      await db.insert(taskAssignees).values(assigneeIds.map((userId) => ({ taskId: id, userId })))
    }
  }

  const updated = await getTaskWithRelations(id)
  return NextResponse.json({ task: updated })
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!canDeleteTask(user)) {
    return NextResponse.json({ error: "Only an admin can delete tasks" }, { status: 403 })
  }

  const { id } = await params
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }
  const task = await getTaskWithRelations(id)
  if (!task || task.deletedAt) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  await db.update(tasks).set({ deletedAt: new Date() }).where(eq(tasks.id, id))
  return NextResponse.json({ ok: true })
}
