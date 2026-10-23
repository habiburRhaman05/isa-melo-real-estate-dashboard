import { and, eq, lt, ne } from "drizzle-orm"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { NextResponse } from "next/server"

import { db } from "@/lib/db"
import { sessions, users } from "@/lib/db/schema"
import type { Role } from "@/lib/db/enums"

export const SESSION_COOKIE = "session"
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 /* 30 days */

export type SessionUser = {
  id: string
  email: string
  name: string
  role: Role
  avatarBg: string
  avatarFg: string
  avatarUrl: string | null
}

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  const [session] = await db.insert(sessions).values({ userId, expiresAt }).returning()

  if (!session) throw new Error("Failed to create session")

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  })
}

export async function destroySession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (token) {
    await db.delete(sessions).where(eq(sessions.id, token))
  }

  cookieStore.delete(SESSION_COOKIE)
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (!token) return null

  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, token),
    with: { user: true },
  })

  if (!session || session.expiresAt < new Date()) return null

  const { user } = session
  if (user.status !== "active") return null

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarBg: user.avatarBg,
    avatarFg: user.avatarFg,
    avatarUrl: user.avatarUrl,
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  return user
}

export async function requireRole(allowed: Role[]): Promise<SessionUser> {
  const user = await requireUser()
  if (!allowed.includes(user.role)) redirect("/")
  return user
}

/* prune expired sessions opportunistically on login */
export async function pruneExpiredSessions() {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
}

export async function touchLastLogin(userId: string) {
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId))
}

/* Revoke every session for a user. Called whenever the credentials or the
   access level behind those sessions change: password reset, deactivation,
   role change. The next request from that browser lands on /login. */
export async function revokeUserSessions(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId))
}

/* Same, but keeps the caller signed in (own password change). */
export async function revokeOtherSessions(userId: string) {
  const cookieStore = await cookies()
  const current = cookieStore.get(SESSION_COOKIE)?.value

  if (!current) {
    await revokeUserSessions(userId)
    return
  }

  await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, current)))
}

/* API-route guard: returns the user or a ready-to-return 401 response.
   Pages use requireUser/requireRole (which redirect); routes must not. */
export async function getApiUser() {
  const user = await getCurrentUser()
  if (!user) {
    return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const
  }
  return { user, response: null } as const
}
