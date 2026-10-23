import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { getTaskWithRelations } from "@/lib/db/queries"
import { comments } from "@/lib/db/schema"
import { canDeleteComment } from "@/lib/permissions"

type Params = { params: Promise<{ id: string; commentId: string }> }

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id, commentId } = await params
  const comment = await db.query.comments.findFirst({
    where: and(eq(comments.id, commentId), eq(comments.taskId, id)),
  })
  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 })
  }

  if (!canDeleteComment(user, comment)) {
    return NextResponse.json({ error: "You can only delete your own comments" }, { status: 403 })
  }

  await db.delete(comments).where(eq(comments.id, commentId))

  const task = await getTaskWithRelations(id)
  return NextResponse.json({ task })
}
