import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { getApiUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { profileUpdateSchema } from "@/lib/validators"

/* Own profile. Every role gets this one: display name and avatar colours.
   Role, status and email stay with the owners. */
export async function PATCH(request: Request) {
  const { user, response } = await getApiUser()
  if (!user) return response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = profileUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid profile" }, { status: 400 })
  }

  const [updated] = await db
    .update(users)
    .set(parsed.data)
    .where(eq(users.id, user.id))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      avatarBg: users.avatarBg,
      avatarFg: users.avatarFg,
      avatarUrl: users.avatarUrl,
    })

  return NextResponse.json({ user: updated })
}
