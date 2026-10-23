import { NextResponse } from "next/server"

import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { getTaskWithRelations } from "@/lib/db/queries"
import { comments } from "@/lib/db/schema"
import { canAccessTask } from "@/lib/permissions"
import { commentCreateSchema } from "@/lib/validators"

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const task = await getTaskWithRelations(id)
  if (!task || task.deletedAt) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  if (!canAccessTask(user, task)) {
    return NextResponse.json({ error: "You can only comment on tasks assigned to you" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = commentCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid comment" }, { status: 400 })
  }

  await db.insert(comments).values({
    taskId: id,
    authorId: user.id,
    authorName: user.name,
    text: parsed.data.text,
  })

  const updated = await getTaskWithRelations(id)
  return NextResponse.json({ task: updated }, { status: 201 })
}
