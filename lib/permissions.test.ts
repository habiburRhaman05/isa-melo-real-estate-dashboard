import type { SessionUser } from "./auth"
import type { Comment } from "./db/schema"
import {
  assignableRoles,
  canAccessTask,
  canAssignRole,
  canCreateTask,
  canDeleteComment,
  canDeleteTask,
  canManageAdmins,
  canManageMembers,
  canManageUser,
  canMoveToStage,
  canSetAssignees,
  canSetRevision,
  canSetSubmissionLink,
  isAssignedTo,
  isOwnerRole,
  isSelf,
} from "./permissions"

function user(role: SessionUser["role"], id = "u1"): SessionUser {
  return { id, email: `${id}@test.com`, name: id, role, avatarBg: "#fff", avatarFg: "#000", avatarUrl: null }
}

type Stage = "new" | "working" | "review" | "revision" | "approved" | "posted"

function taskWith(assigneeIds: string[], stage: Stage = "new") {
  return { assignees: assigneeIds.map((userId) => ({ userId })), stage }
}

describe("isOwnerRole", () => {
  it("is true for admin and super_admin, false for member", () => {
    expect(isOwnerRole(user("member"))).toBe(false)
    expect(isOwnerRole(user("admin"))).toBe(true)
    expect(isOwnerRole(user("super_admin"))).toBe(true)
  })
})

describe("isAssignedTo / canAccessTask", () => {
  it("a member can access only a task they are assigned to", () => {
    const member = user("member", "u1")
    expect(isAssignedTo(member, taskWith(["u1", "u2"]))).toBe(true)
    expect(isAssignedTo(member, taskWith(["u2"]))).toBe(false)
    expect(canAccessTask(member, taskWith(["u2"]))).toBe(false)
    expect(canAccessTask(member, taskWith(["u1"]))).toBe(true)
  })

  it("an owner can access any task regardless of assignment", () => {
    const admin = user("admin", "owner1")
    expect(canAccessTask(admin, taskWith([]))).toBe(true)
    expect(canAccessTask(admin, taskWith(["someone-else"]))).toBe(true)
  })
})

describe("canMoveToStage", () => {
  it("blocks a member from moving a task they are not assigned to, to any stage", () => {
    const member = user("member", "u1")
    expect(canMoveToStage(member, taskWith(["other"]), "working")).toBe(false)
  })

  it("blocks a member from moving their own task into an owner-only stage", () => {
    const member = user("member", "u1")
    const task = taskWith(["u1"])
    expect(canMoveToStage(member, task, "approved")).toBe(false)
    expect(canMoveToStage(member, task, "posted")).toBe(false)
  })

  it("allows a member to move their own task between non-owner-only stages", () => {
    const member = user("member", "u1")
    const task = taskWith(["u1"])
    expect(canMoveToStage(member, task, "working")).toBe(true)
    expect(canMoveToStage(member, task, "review")).toBe(true)
    expect(canMoveToStage(member, task, "revision")).toBe(true)
  })

  it("lets an owner move any task to any stage, including approved/posted", () => {
    const admin = user("admin", "owner1")
    const task = taskWith(["someone-else"])
    expect(canMoveToStage(admin, task, "approved")).toBe(true)
    expect(canMoveToStage(admin, task, "posted")).toBe(true)
  })
})

describe("task mutation permissions (owner-only actions)", () => {
  it("canCreateTask/canDeleteTask/canSetRevision/canSetAssignees are owner-only", () => {
    const member = user("member")
    const admin = user("admin")
    for (const check of [canCreateTask, canDeleteTask, canSetRevision, canSetAssignees]) {
      expect(check(member)).toBe(false)
      expect(check(admin)).toBe(true)
    }
  })
})

describe("canSetSubmissionLink", () => {
  it("lets the team fill in the submission link and blocks owners from changing it", () => {
    expect(canSetSubmissionLink(user("member"))).toBe(true)
    expect(canSetSubmissionLink(user("admin"))).toBe(false)
    expect(canSetSubmissionLink(user("super_admin"))).toBe(false)
  })
})

describe("canDeleteComment", () => {
  it("lets the author delete their own comment", () => {
    const member = user("member", "u1")
    const comment = { authorId: "u1" } as Comment
    expect(canDeleteComment(member, comment)).toBe(true)
  })

  it("blocks a member from deleting someone else's comment", () => {
    const member = user("member", "u1")
    const comment = { authorId: "u2" } as Comment
    expect(canDeleteComment(member, comment)).toBe(false)
  })

  it("lets an owner delete any comment", () => {
    const admin = user("admin", "owner1")
    const comment = { authorId: "u2" } as Comment
    expect(canDeleteComment(admin, comment)).toBe(true)
  })
})

describe("user administration permissions", () => {
  it("canManageMembers is owner-only", () => {
    expect(canManageMembers(user("member"))).toBe(false)
    expect(canManageMembers(user("admin"))).toBe(true)
    expect(canManageMembers(user("super_admin"))).toBe(true)
  })

  it("canManageAdmins is super_admin-only", () => {
    expect(canManageAdmins(user("member"))).toBe(false)
    expect(canManageAdmins(user("admin"))).toBe(false)
    expect(canManageAdmins(user("super_admin"))).toBe(true)
  })

  it("an admin can manage members but not other admins or super admins", () => {
    const admin = user("admin", "a1")
    expect(canManageUser(admin, { id: "m1", role: "member" })).toBe(true)
    expect(canManageUser(admin, { id: "a2", role: "admin" })).toBe(false)
    expect(canManageUser(admin, { id: "s1", role: "super_admin" })).toBe(false)
  })

  it("a super admin can manage everyone", () => {
    const superAdmin = user("super_admin", "s1")
    expect(canManageUser(superAdmin, { id: "m1", role: "member" })).toBe(true)
    expect(canManageUser(superAdmin, { id: "a2", role: "admin" })).toBe(true)
    expect(canManageUser(superAdmin, { id: "s2", role: "super_admin" })).toBe(true)
  })

  it("a member can manage no one", () => {
    const member = user("member", "m1")
    expect(canManageUser(member, { id: "m2", role: "member" })).toBe(false)
  })

  it("assignableRoles/canAssignRole scope admin to members only, super admin to everything", () => {
    expect(assignableRoles(user("member"))).toEqual([])
    expect(assignableRoles(user("admin"))).toEqual(["member"])
    expect(assignableRoles(user("super_admin"))).toEqual(["member", "admin", "super_admin"])

    expect(canAssignRole(user("admin"), "admin")).toBe(false)
    expect(canAssignRole(user("super_admin"), "admin")).toBe(true)
  })

  it("isSelf matches only the same id", () => {
    const actor = user("admin", "a1")
    expect(isSelf(actor, { id: "a1", role: "admin" })).toBe(true)
    expect(isSelf(actor, { id: "a2", role: "admin" })).toBe(false)
  })
})
