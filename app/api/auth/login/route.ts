import { NextResponse } from "next/server"

import { createSession, pruneExpiredSessions, touchLastLogin } from "@/lib/auth"
import { findUserByEmail } from "@/lib/db/queries"
import { verifyPassword } from "@/lib/password"
import { loginSchema } from "@/lib/validators"

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password" }, { status: 400 })
  }

  const { email, password } = parsed.data

  const user = await findUserByEmail(email)
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
  }

  if (user.status !== "active") {
    return NextResponse.json({ error: "This account is inactive. Contact your admin." }, { status: 403 })
  }

  await pruneExpiredSessions()
  await createSession(user.id)
  await touchLastLogin(user.id)

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarBg: user.avatarBg,
      avatarFg: user.avatarFg,
      avatarUrl: user.avatarUrl,
    },
  })
}
