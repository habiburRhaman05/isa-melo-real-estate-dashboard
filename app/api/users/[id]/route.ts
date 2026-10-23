import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { getApiUser, revokeUserSessions } from "@/lib/auth"
import { db } from "@/lib/db"
import { countActiveSuperAdmins, findUserByEmail, findUserById } from "@/lib/db/queries"
import { users } from "@/lib/db/schema"
import { canAssignRole, canManageMembers, canManageUser, isSelf } from "@/lib/permissions"
import { userUpdateSchema } from "@/lib/validators"

type Params = { params: Promise<{ id: string }> }

/* The account edits an owner can make: name, email, avatar colours, role and
   active/inactive. Anything that changes who the account is or what it can
   reach drops its sessions, so an open tab can't keep the old access. */
export async function PATCH(request: Request, { params }: Params) {
  const { user, response } = await getApiUser()
  if (!user) return response

  if (!canManageMembers(user)) {
    return NextResponse.json({ error: "Only an admin can edit accounts" }, { status: 403 })
  }

  const { id } = await params
  const target = await findUserById(id)
  if (!target) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  if (!canManageUser(user, target)) {
    return NextResponse.json({ error: "Only a super admin can edit this account" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = userUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid update" }, { status: 400 })
  }

  const data = parsed.data
  const self = isSelf(user, target)

  if (data.role !== undefined && data.role !== target.role) {
    if (!canAssignRole(user, data.role)) {
      return NextResponse.json({ error: "You can't assign that role" }, { status: 403 })
    }
    if (self) {
      return NextResponse.json({ error: "You can't change your own role" }, { status: 403 })
    }
    /* only an *active* super admin counts towards the floor: demoting one who
       is already deactivated takes nobody's access away */
    if (
      target.role === "super_admin" &&
      target.status === "active" &&
      (await countActiveSuperAdmins()) <= 1
    ) {
      return NextResponse.json({ error: "This is the last super admin" }, { status: 409 })
    }
  }

  if (data.status !== undefined && data.status !== target.status) {
    if (self) {
      return NextResponse.json({ error: "You can't deactivate your own account" }, { status: 403 })
    }
    if (
      data.status === "inactive" &&
      target.role === "super_admin" &&
      (await countActiveSuperAdmins()) <= 1
    ) {
      return NextResponse.json({ error: "This is the last super admin" }, { status: 409 })
    }
  }

  if (data.email !== undefined && data.email !== target.email) {
    const clash = await findUserByEmail(data.email)
    if (clash && clash.id !== target.id) {
      return NextResponse.json({ error: "That email is already in use" }, { status: 409 })
    }
  }

  const [updated] = await db
    .update(users)
    .set(data)
    .where(eq(users.id, id))
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

  const accessChanged =
    (data.role !== undefined && data.role !== target.role) ||
    (data.status !== undefined && data.status !== target.status) ||
    (data.email !== undefined && data.email !== target.email)

  if (accessChanged && !self) {
    await revokeUserSessions(id)
  }

  return NextResponse.json({ user: updated })
}

/* Deactivate, never delete: comment authors, assignee links and activity
   history all point at this row and have to stay readable. */
export async function DELETE(_request: Request, { params }: Params) {
  const { user, response } = await getApiUser()
  if (!user) return response

  if (!canManageMembers(user)) {
    return NextResponse.json({ error: "Only an admin can deactivate accounts" }, { status: 403 })
  }

  const { id } = await params
  const target = await findUserById(id)
  if (!target) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  if (!canManageUser(user, target)) {
    return NextResponse.json({ error: "Only a super admin can remove this account" }, { status: 403 })
  }

  if (isSelf(user, target)) {
    return NextResponse.json({ error: "You can't deactivate your own account" }, { status: 403 })
  }

  if (
    target.role === "super_admin" &&
    target.status === "active" &&
    (await countActiveSuperAdmins()) <= 1
  ) {
    return NextResponse.json({ error: "This is the last super admin" }, { status: 409 })
  }

  await db.update(users).set({ status: "inactive" }).where(eq(users.id, id))
  await revokeUserSessions(id)

  return NextResponse.json({ ok: true })
}
