import { OWNER_ONLY_STAGES } from "@/lib/db/enums"
import type { Comment } from "@/lib/db/schema"
import type { SessionUser } from "@/lib/auth"
import type { Role, TaskStage } from "@/lib/db/enums"

type TaskForPermissions = {
  assignees: { userId: string }[]
}

export function isOwnerRole(user: SessionUser) {
  return user.role === "admin" || user.role === "super_admin"
}

export function isAssignedTo(user: SessionUser, task: TaskForPermissions) {
  return task.assignees.some((a) => a.userId === user.id)
}

/* Any field edit, moving within non-owner-only stages, and commenting
   follow the same rule: owners can touch any task, members only their own. */
export function canAccessTask(user: SessionUser, task: TaskForPermissions) {
  return isOwnerRole(user) || isAssignedTo(user, task)
}

export function canMoveToStage(user: SessionUser, task: TaskForPermissions, stage: TaskStage) {
  if (!canAccessTask(user, task)) return false
  if (!isOwnerRole(user) && OWNER_ONLY_STAGES.includes(stage)) return false
  return true
}

export function canCreateTask(user: SessionUser) {
  return isOwnerRole(user)
}

export function canDeleteTask(user: SessionUser) {
  return isOwnerRole(user)
}

export function canSetRevision(user: SessionUser) {
  return isOwnerRole(user)
}

export function canSetAssignees(user: SessionUser) {
  return isOwnerRole(user)
}

/* The submission/video link is supplied by the team that does the work, so it
   is the one task field owners can read and open but never write. */
export function canSetSubmissionLink(user: SessionUser) {
  return !isOwnerRole(user)
}

export function canDeleteComment(user: SessionUser, comment: Comment) {
  return isOwnerRole(user) || comment.authorId === user.id
}

/* ---------- user administration ----------
   Two tiers, matching the two pages:
   - admins manage members only (Team page)
   - super admins manage everyone, including other admins (Admins page)
   On top of that, nobody may demote, deactivate or delete themselves: that is
   the one move that can lock the only owner out of their own dashboard. */

type ManagedUser = {
  id: string
  role: Role
}

export function canManageMembers(user: SessionUser) {
  return isOwnerRole(user)
}

export function canManageAdmins(user: SessionUser) {
  return user.role === "super_admin"
}

export function canManageUser(actor: SessionUser, target: ManagedUser) {
  if (actor.role === "super_admin") return true
  if (actor.role === "admin") return target.role === "member"
  return false
}

/* Which roles this actor is allowed to hand out. */
export function assignableRoles(actor: SessionUser): Role[] {
  if (actor.role === "super_admin") return ["member", "admin", "super_admin"]
  if (actor.role === "admin") return ["member"]
  return []
}

export function canAssignRole(actor: SessionUser, role: Role) {
  return assignableRoles(actor).includes(role)
}

export function isSelf(actor: SessionUser, target: ManagedUser) {
  return actor.id === target.id
}

/* ---------- website leads ----------
   Leads are owner-only for now (confirmed with the user): admin/super_admin
   see and manage every lead, members don't get the nav item at all. One
   check covers create/edit/move/delete/log-activity since they're all the
   same tier - no per-lead assignment scoping like tasks have. */
export function canManageLeads(user: SessionUser) {
  return isOwnerRole(user)
}
