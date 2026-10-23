import type { Mock } from "vitest"

import { randomUUID } from "node:crypto"

import { inArray } from "drizzle-orm"
import { cookies } from "next/headers"

/* next/headers only works inside a real request context; every route under
   test reaches it indirectly through lib/auth's getCurrentUser(). Mocking it
   here lets us drive the actual exported route handlers against the real
   dev database - this is a true integration test, not a mock of the DB. */
vi.mock("next/headers", () => ({ cookies: vi.fn() }))

import { POST as addComment } from "@/app/api/tasks/[id]/comments/route"
import { DELETE as deleteTask, PATCH as patchTask } from "@/app/api/tasks/[id]/route"
import { POST as createTask, GET as listTasks } from "@/app/api/tasks/route"
import { db } from "@/lib/db"
import { comments, sessions, taskAssignees, tasks, users } from "@/lib/db/schema"
import { hashPassword } from "@/lib/password"

/* every call here is a real round trip to Neon Postgres (no mocked DB), and
   some tests chain several of them - the 5s/10s vitest defaults are tuned
   for in-memory unit tests, not this. */
vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 })

const tag = randomUUID().slice(0, 8)

let adminId: string
let memberId: string
let otherMemberId: string
let adminSessionId: string
let memberSessionId: string
let otherMemberSessionId: string
const createdTaskIds: string[] = []

function asUser(sessionId: string) {
  ;(cookies as unknown as Mock).mockResolvedValue({
    get: (name: string) => (name === "session" ? { name, value: sessionId } : undefined),
  })
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

beforeAll(async () => {
  const passwordHash = await hashPassword("Integration@Test1")

  const [admin] = await db
    .insert(users)
    .values({ email: `it-admin-${tag}@test.local`, name: "IT Admin", passwordHash, role: "admin" })
    .returning()
  const [member] = await db
    .insert(users)
    .values({ email: `it-member-${tag}@test.local`, name: "IT Member", passwordHash, role: "member" })
    .returning()
  const [other] = await db
    .insert(users)
    .values({ email: `it-other-${tag}@test.local`, name: "IT Other", passwordHash, role: "member" })
    .returning()

  adminId = admin!.id
  memberId = member!.id
  otherMemberId = other!.id

  const expiresAt = new Date(Date.now() + 86_400_000)
  const [adminSession] = await db.insert(sessions).values({ userId: adminId, expiresAt }).returning()
  const [memberSession] = await db.insert(sessions).values({ userId: memberId, expiresAt }).returning()
  const [otherSession] = await db.insert(sessions).values({ userId: otherMemberId, expiresAt }).returning()

  adminSessionId = adminSession!.id
  memberSessionId = memberSession!.id
  otherMemberSessionId = otherSession!.id
})

afterAll(async () => {
  if (createdTaskIds.length > 0) {
    await db.delete(comments).where(inArray(comments.taskId, createdTaskIds))
    await db.delete(taskAssignees).where(inArray(taskAssignees.taskId, createdTaskIds))
    await db.delete(tasks).where(inArray(tasks.id, createdTaskIds))
  }
  await db.delete(sessions).where(inArray(sessions.userId, [adminId, memberId, otherMemberId]))
  await db.delete(users).where(inArray(users.id, [adminId, memberId, otherMemberId]))
})

describe("task API integration", () => {
  it("rejects an invalid calendar date before ever reaching the database", async () => {
    asUser(adminSessionId)
    const res = await createTask(
      jsonRequest("http://localhost/api/tasks", "POST", { title: "Bad date", due: "2026-02-30" }),
    )
    expect(res.status).toBe(400)
  })

  it("lets an admin create a task with an assignee", async () => {
    asUser(adminSessionId)
    const res = await createTask(
      jsonRequest("http://localhost/api/tasks", "POST", {
        title: `IT task ${tag}`,
        assigneeIds: [memberId],
        cost: 25,
      }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as { task: { id: string; number: number; assignees: { userId: string }[] } }
    createdTaskIds.push(body.task.id)
    expect(body.task.assignees.map((a) => a.userId)).toEqual([memberId])
  })

  it("blocks a member who is not assigned from creating tasks", async () => {
    asUser(memberSessionId)
    const res = await createTask(jsonRequest("http://localhost/api/tasks", "POST", { title: "Nope" }))
    expect(res.status).toBe(403)
  })

  it("lets any authenticated user list tasks", async () => {
    asUser(memberSessionId)
    const res = await listTasks()
    expect(res.status).toBe(200)
    const body = (await res.json()) as { tasks: { id: string }[] }
    expect(body.tasks.some((t) => t.id === createdTaskIds[0])).toBe(true)
  })

  it("blocks the unassigned member from editing the task", async () => {
    asUser(otherMemberSessionId)
    const res = await patchTask(
      jsonRequest(`http://localhost/api/tasks/${createdTaskIds[0]}`, "PATCH", { title: "Hijacked" }),
      { params: Promise.resolve({ id: createdTaskIds[0]! }) },
    )
    expect(res.status).toBe(403)
  })

  it("lets the assigned member edit the task but not move it to an owner-only stage", async () => {
    asUser(memberSessionId)

    const editRes = await patchTask(
      jsonRequest(`http://localhost/api/tasks/${createdTaskIds[0]}`, "PATCH", { title: "Edited by member" }),
      { params: Promise.resolve({ id: createdTaskIds[0]! }) },
    )
    expect(editRes.status).toBe(200)
    const edited = (await editRes.json()) as { task: { title: string } }
    expect(edited.task.title).toBe("Edited by member")

    const lockedStageRes = await patchTask(
      jsonRequest(`http://localhost/api/tasks/${createdTaskIds[0]}`, "PATCH", { stage: "approved" }),
      { params: Promise.resolve({ id: createdTaskIds[0]! }) },
    )
    expect(lockedStageRes.status).toBe(403)
  })

  it("blocks the assigned member from setting a revision request", async () => {
    asUser(memberSessionId)
    const res = await patchTask(
      jsonRequest(`http://localhost/api/tasks/${createdTaskIds[0]}`, "PATCH", { revision: "fix this" }),
      { params: Promise.resolve({ id: createdTaskIds[0]! }) },
    )
    expect(res.status).toBe(403)
  })

  it("lets the admin move the task to an owner-only stage and set a revision", async () => {
    asUser(adminSessionId)
    const res = await patchTask(
      jsonRequest(`http://localhost/api/tasks/${createdTaskIds[0]}`, "PATCH", {
        stage: "approved",
        revision: "looks good, minor tweak",
      }),
      { params: Promise.resolve({ id: createdTaskIds[0]! }) },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { task: { stage: string; revision: string | null } }
    expect(body.task.stage).toBe("approved")
    expect(body.task.revision).toBe("looks good, minor tweak")
  })

  it("lets the assigned member comment, blocks the unassigned member", async () => {
    asUser(memberSessionId)
    const ok = await addComment(jsonRequest(`http://localhost/api/tasks/${createdTaskIds[0]}/comments`, "POST", { text: "on it" }), {
      params: Promise.resolve({ id: createdTaskIds[0]! }),
    })
    expect(ok.status).toBe(201)

    asUser(otherMemberSessionId)
    const blocked = await addComment(
      jsonRequest(`http://localhost/api/tasks/${createdTaskIds[0]}/comments`, "POST", { text: "butting in" }),
      { params: Promise.resolve({ id: createdTaskIds[0]! }) },
    )
    expect(blocked.status).toBe(403)
  })

  it("keeps the submission link team-owned: the admin can read it but only the member can set it", async () => {
    asUser(adminSessionId)
    const created = await createTask(
      jsonRequest("http://localhost/api/tasks", "POST", {
        title: `IT link task ${tag}`,
        assigneeIds: [memberId],
      }),
    )
    expect(created.status).toBe(201)
    const taskId = ((await created.json()) as { task: { id: string } }).task.id
    createdTaskIds.push(taskId)

    const adminLinkChange = await patchTask(
      jsonRequest(`http://localhost/api/tasks/${taskId}`, "PATCH", { link: "https://evil.example/x" }),
      { params: Promise.resolve({ id: taskId }) },
    )
    expect(adminLinkChange.status).toBe(403)
    await expect(adminLinkChange.json()).resolves.toMatchObject({
      error: "The submission link is set by the team, not by an admin",
    })

    asUser(memberSessionId)
    const memberSetsLink = await patchTask(
      jsonRequest(`http://localhost/api/tasks/${taskId}`, "PATCH", { link: "https://frame.io/review/abc" }),
      { params: Promise.resolve({ id: taskId }) },
    )
    expect(memberSetsLink.status).toBe(200)
    await expect(memberSetsLink.json()).resolves.toMatchObject({
      task: { link: "https://frame.io/review/abc" },
    })

    asUser(adminSessionId)
    /* re-sending the same value isn't a change, so it must not be rejected */
    const adminSameLink = await patchTask(
      jsonRequest(`http://localhost/api/tasks/${taskId}`, "PATCH", { link: "https://frame.io/review/abc" }),
      { params: Promise.resolve({ id: taskId }) },
    )
    expect(adminSameLink.status).toBe(200)

    const adminCreateWithLink = await createTask(
      jsonRequest("http://localhost/api/tasks", "POST", { title: `IT link create ${tag}`, link: "https://x.example" }),
    )
    expect(adminCreateWithLink.status).toBe(403)
  })

  it("404s a malformed task id instead of failing the database query", async () => {
    asUser(adminSessionId)
    const res = await patchTask(
      jsonRequest("http://localhost/api/tasks/not-a-uuid", "PATCH", { title: "x" }),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    )
    expect(res.status).toBe(404)
  })

  it("blocks a member from deleting a task, lets the admin soft-delete it, and 404s a second delete", async () => {
    asUser(memberSessionId)
    const blocked = await deleteTask(new Request("http://localhost", { method: "DELETE" }), {
      params: Promise.resolve({ id: createdTaskIds[0]! }),
    })
    expect(blocked.status).toBe(403)

    asUser(adminSessionId)
    const deleted = await deleteTask(new Request("http://localhost", { method: "DELETE" }), {
      params: Promise.resolve({ id: createdTaskIds[0]! }),
    })
    expect(deleted.status).toBe(200)

    const deletedTwice = await deleteTask(new Request("http://localhost", { method: "DELETE" }), {
      params: Promise.resolve({ id: createdTaskIds[0]! }),
    })
    expect(deletedTwice.status).toBe(404)

    const listRes = await listTasks()
    const body = (await listRes.json()) as { tasks: { id: string }[] }
    expect(body.tasks.some((t) => t.id === createdTaskIds[0])).toBe(false)
  })
})
