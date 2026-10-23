import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { getApiUser, revokeUserSessions } from "@/lib/auth"
import { db } from "@/lib/db"
import { findUserById } from "@/lib/db/queries"
import { users } from "@/lib/db/schema"
import { canManageMembers, canManageUser, isSelf } from "@/lib/permissions"
import { hashPassword } from "@/lib/password"
import { passwordResetSchema } from "@/lib/validators"

type Params = { params: Promise<{ id: string }> }

/* Admin-set password. There is no self-service reset flow: accounts are
   created by owners, so recovery runs through them too. */
export async function POST(request: Request, { params }: Params) {
  const { user, response } = await getApiUser()
  if (!user) return response

  if (!canManageMembers(user)) {
    return NextResponse.json({ error: "Only an admin can reset passwords" }, { status: 403 })
  }

  const { id } = await params
  const target = await findUserById(id)
  if (!target) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  if (!canManageUser(user, target)) {
    return NextResponse.json({ error: "Only a super admin can reset this password" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = passwordResetSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid password" }, { status: 400 })
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.password) })
    .where(eq(users.id, id))

  /* an owner resetting their own password here would sign themselves out */
  if (!isSelf(user, target)) {
    await revokeUserSessions(id)
  }

  return NextResponse.json({ ok: true })
}
