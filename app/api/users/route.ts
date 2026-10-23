import { NextResponse } from "next/server"

import { getApiUser, getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { findUserByEmail, getDirectoryUsers, getTeamUsers } from "@/lib/db/queries"
import { users } from "@/lib/db/schema"
import { canAssignRole, canManageMembers } from "@/lib/permissions"
import { hashPassword } from "@/lib/password"
import { userCreateSchema } from "@/lib/validators"

/* ?scope=directory returns every account plus open-task counts for the Team
   and Admins pages. The default (active members only) is what the planner's
   assignee picker needs, so members keep working without seeing the roster. */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const scope = new URL(request.url).searchParams.get("scope")

  if (scope === "directory") {
    if (!canManageMembers(user)) {
      return NextResponse.json({ error: "Only an admin can view the team roster" }, { status: 403 })
    }
    return NextResponse.json({ users: await getDirectoryUsers() })
  }

  return NextResponse.json({ users: await getTeamUsers() })
}

export async function POST(request: Request) {
  const { user, response } = await getApiUser()
  if (!user) return response

  if (!canManageMembers(user)) {
    return NextResponse.json({ error: "Only an admin can add accounts" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = userCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid account" }, { status: 400 })
  }

  const data = parsed.data

  if (!canAssignRole(user, data.role)) {
    return NextResponse.json(
      { error: "Only a super admin can create admin accounts" },
      { status: 403 },
    )
  }

  if (await findUserByEmail(data.email)) {
    return NextResponse.json({ error: "That email is already in use" }, { status: 409 })
  }

  const [created] = await db
    .insert(users)
    .values({
      name: data.name,
      email: data.email,
      passwordHash: await hashPassword(data.password),
      role: data.role,
      avatarBg: data.avatarBg,
      avatarFg: data.avatarFg,
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      status: users.status,
      avatarBg: users.avatarBg,
      avatarFg: users.avatarFg,
      avatarUrl: users.avatarUrl,
    })

  return NextResponse.json({ user: created }, { status: 201 })
}
