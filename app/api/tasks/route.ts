import { NextResponse } from "next/server"

import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { getPlannerTasks, getTaskWithRelations } from "@/lib/db/queries"
import { comments, taskAssignees, tasks } from "@/lib/db/schema"
import { canCreateTask, canSetSubmissionLink } from "@/lib/permissions"
import { taskCreateSchema } from "@/lib/validators"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const allTasks = await getPlannerTasks()
  return NextResponse.json({ tasks: allTasks })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!canCreateTask(user)) {
    return NextResponse.json({ error: "Only an admin can create tasks" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = taskCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid task" }, { status: 400 })
  }

  const { assigneeIds, initialComments, ...data } = parsed.data

  if (data.link && !canSetSubmissionLink(user)) {
    return NextResponse.json(
      { error: "The submission link is set by the team, not by an admin" },
      { status: 403 },
    )
  }

  const [created] = await db
    .insert(tasks)
    .values({
      title: data.title,
      type: data.type,
      desc: data.desc,
      prompt: data.prompt,
      ref: data.ref,
      link: data.link,
      due: data.due,
      cost: String(data.cost),
      priority: data.priority,
      stage: data.stage,
      revision: data.revision,
      createdBy: user.id,
    })
    .returning()

  if (!created) {
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
  }

  if (assigneeIds.length > 0) {
    await db.insert(taskAssignees).values(assigneeIds.map((userId) => ({ taskId: created.id, userId })))
  }

  if (initialComments.length > 0) {
    await db.insert(comments).values(
      initialComments.map((text) => ({
        taskId: created.id,
        authorId: user.id,
        authorName: user.name,
        text,
      })),
    )
  }

  const task = await getTaskWithRelations(created.id)
  return NextResponse.json({ task }, { status: 201 })
}
