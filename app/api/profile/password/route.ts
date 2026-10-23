import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { getApiUser, revokeOtherSessions } from "@/lib/auth"
import { db } from "@/lib/db"
import { findUserById } from "@/lib/db/queries"
import { users } from "@/lib/db/schema"
import { hashPassword, verifyPassword } from "@/lib/password"
import { passwordChangeSchema } from "@/lib/validators"

/* Own password change. Proving the current password is what makes this safe
   to expose to every role; a stolen open tab can't silently take the account
   over. Other sessions are dropped, this one survives. */
export async function POST(request: Request) {
  const { user, response } = await getApiUser()
  if (!user) return response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = passwordChangeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid password" }, { status: 400 })
  }

  const record = await findUserById(user.id)
  if (!record) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  if (!(await verifyPassword(parsed.data.currentPassword, record.passwordHash))) {
    return NextResponse.json({ error: "Your current password is incorrect" }, { status: 403 })
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.newPassword) })
    .where(eq(users.id, user.id))

  await revokeOtherSessions(user.id)

  return NextResponse.json({ ok: true })
}
