import { LEAD_STAGES, ROLES, TASK_STAGES, TASK_TYPES } from "./enums"
import {
  comments,
  leadActivities,
  leads,
  sessions,
  settings,
  taskAssignees,
  tasks,
  users,
} from "./schema"

describe("db schema", () => {
  it("keeps the prototype task stages", () => {
    expect(TASK_STAGES).toEqual(["new", "working", "review", "revision", "approved", "posted"])
  })

  it("keeps the prototype lead stages", () => {
    expect(LEAD_STAGES).toEqual(["new", "contacted", "qualified", "proposal", "won", "lost"])
  })

  it("defines the three roles", () => {
    expect(ROLES).toEqual(["member", "admin", "super_admin"])
  })

  it("keeps the prototype task types", () => {
    expect(TASK_TYPES).toEqual(["post", "reel", "video", "image"])
  })

  it("supports multi-assignee through a junction table", () => {
    expect(Object.keys(taskAssignees)).toEqual(
      expect.arrayContaining(["taskId", "userId", "assignedAt"])
    )
  })

  it("keeps author name snapshots on comments and activities", () => {
    expect(Object.keys(comments)).toEqual(expect.arrayContaining(["authorId", "authorName"]))
    expect(Object.keys(leadActivities)).toEqual(expect.arrayContaining(["authorId", "authorName"]))
  })

  it("has the core tables with the expected columns", () => {
    expect(Object.keys(users)).toEqual(
      expect.arrayContaining(["email", "passwordHash", "role", "status", "avatarBg", "avatarFg"])
    )
    expect(Object.keys(tasks)).toEqual(
      expect.arrayContaining([
        "title",
        "type",
        "priority",
        "stage",
        "cost",
        "due",
        "revision",
        "createdBy",
        "deletedAt",
      ])
    )
    expect(Object.keys(leads)).toEqual(
      expect.arrayContaining([
        "firstName",
        "phone",
        "business",
        "country",
        "value",
        "stage",
        "assigneeId",
        "followUp",
        "closedAt",
        "deletedAt",
      ])
    )
    expect(Object.keys(sessions)).toEqual(expect.arrayContaining(["userId", "expiresAt"]))
    expect(Object.keys(settings)).toEqual(expect.arrayContaining(["key", "value"]))
  })
})
