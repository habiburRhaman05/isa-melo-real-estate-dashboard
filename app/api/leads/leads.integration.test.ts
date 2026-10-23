import type { Mock } from "vitest"

import { randomUUID } from "node:crypto"

import { inArray } from "drizzle-orm"
import { cookies } from "next/headers"

/* next/headers only exists inside a real request; this is the same seam the
   task integration suite uses to drive the exported handlers directly. */
vi.mock("next/headers", () => ({ cookies: vi.fn() }))

vi.mock("@/env.mjs", () => ({
  env: {
    GHL_PIT_TOKEN: undefined,
    GHL_LOCATION_ID: undefined,
    GHL_PIPELINE_NAME: "Dubai Off Plan Sales",
    GHL_WEBHOOK_SECRET: undefined,
  },
}))

const PIPELINE = vi.hoisted(() => ({
  id: "pipe-test",
  name: "Dubai Off Plan Sales",
  connected: true,
  syncedAt: 0,
  stages: [
    { id: "st-new", name: "New Lead", color: "#a99bd0", bg: "#ece4fa", fg: "#6b5f8a" },
    { id: "st-contacted", name: "Contacted", color: "#5a2d9c", bg: "#ece4fa", fg: "#5a2d9c" },
    { id: "st-won", name: "Closed Won", color: "#2f9e6e", bg: "#d5eadf", fg: "#25704f" },
  ],
}))

vi.mock("@/lib/ghl-pipeline", () => ({
  getLeadPipeline: async () => PIPELINE,
  getLeadPipelineStages: async () => PIPELINE.stages,
}))

const syncMock = vi.hoisted(() => ({ syncLeadsFromGhl: vi.fn() }))

vi.mock("@/lib/ghl-sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ghl-sync")>()
  return { ...actual, syncLeadsFromGhl: syncMock.syncLeadsFromGhl }
})

import { POST as addActivity } from "@/app/api/leads/[id]/activities/route"
import { DELETE as deleteLead, PATCH as patchLead } from "@/app/api/leads/[id]/route"
import { POST as createLead, GET as listLeads } from "@/app/api/leads/route"
import { POST as syncLeads } from "@/app/api/leads/sync/route"
import { db } from "@/lib/db"
import { leadActivities, leads, sessions, users } from "@/lib/db/schema"
import { hashPassword } from "@/lib/password"

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 })

const tag = randomUUID().slice(0, 8)

let adminId: string
let memberId: string
let adminSessionId: string
let memberSessionId: string
const createdLeadIds: string[] = []

function asUser(sessionId: string | null) {
  ;(cookies as unknown as Mock).mockResolvedValue({
    get: (name: string) => (name === "session" && sessionId ? { name, value: sessionId } : undefined),
  })
}

function jsonRequest(method: string, body?: unknown) {
  return new Request("http://localhost/api/leads", {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

async function createAsAdmin(overrides: Record<string, unknown> = {}) {
  asUser(adminSessionId)
  const res = await createLead(
    jsonRequest("POST", { firstName: `Lead ${tag}`, email: `lead-${randomUUID()}@api-it.local`, ...overrides }),
  )
  const body = (await res.json()) as { lead?: { id: string }; error?: string }
  if (body.lead?.id) createdLeadIds.push(body.lead.id)
  return { res, body }
}

beforeAll(async () => {
  const passwordHash = await hashPassword("Integration@Test1")

  const [admin] = await db
    .insert(users)
    .values({ email: `leads-it-admin-${tag}@test.local`, name: "Lead Admin", passwordHash, role: "admin" })
    .returning()
  const [member] = await db
    .insert(users)
    .values({ email: `leads-it-member-${tag}@test.local`, name: "Lead Member", passwordHash, role: "member" })
    .returning()

  adminId = admin!.id
  memberId = member!.id

  const expiresAt = new Date(Date.now() + 86_400_000)
  const [adminSession] = await db.insert(sessions).values({ userId: adminId, expiresAt }).returning()
  const [memberSession] = await db.insert(sessions).values({ userId: memberId, expiresAt }).returning()

  adminSessionId = adminSession!.id
  memberSessionId = memberSession!.id
})

afterAll(async () => {
  if (createdLeadIds.length > 0) {
    await db.delete(leadActivities).where(inArray(leadActivities.leadId, createdLeadIds))
    await db.delete(leads).where(inArray(leads.id, createdLeadIds))
  }
  await db.delete(sessions).where(inArray(sessions.userId, [adminId, memberId]))
  await db.delete(users).where(inArray(users.id, [adminId, memberId]))
})

beforeEach(() => {
  syncMock.syncLeadsFromGhl.mockReset()
})

describe("leads API access control", () => {
  it("rejects anonymous callers", async () => {
    asUser(null)
    expect((await listLeads()).status).toBe(401)
    expect((await createLead(jsonRequest("POST", { firstName: "Nope" }))).status).toBe(401)
  })

  it("blocks members from every leads operation", async () => {
    asUser(memberSessionId)
    expect((await listLeads()).status).toBe(403)
    expect((await createLead(jsonRequest("POST", { firstName: "Nope" }))).status).toBe(403)
    expect((await patchLead(jsonRequest("PATCH", { firstName: "Nope" }), params(randomUUID()))).status).toBe(403)
    expect((await deleteLead(jsonRequest("DELETE"), params(randomUUID()))).status).toBe(403)
    expect((await addActivity(jsonRequest("POST", { type: "note", text: "hi" }), params(randomUUID()))).status).toBe(
      403,
    )
    expect((await syncLeads()).status).toBe(403)
  })

  it("returns 404 for a malformed id instead of letting Postgres throw", async () => {
    asUser(adminSessionId)
    expect((await patchLead(jsonRequest("PATCH", { firstName: "X" }), params("not-a-uuid"))).status).toBe(404)
    expect((await deleteLead(jsonRequest("DELETE"), params("not-a-uuid"))).status).toBe(404)
    expect(
      (await addActivity(jsonRequest("POST", { type: "note", text: "hi" }), params("not-a-uuid"))).status,
    ).toBe(404)
  })
})

describe("POST /api/leads", () => {
  it("creates a lead in the first GHL stage and records the activity", async () => {
    const { res, body } = await createAsAdmin({ firstName: "Layla", lastName: "Haddad", value: 500000 })

    expect(res.status).toBe(201)
    const created = body.lead as unknown as {
      id: string
      stage: string
      value: string
      source: string
      activities: { type: string; text: string }[]
    }
    expect(created.stage).toBe("st-new")
    expect(created.value).toBe("500000.00")
    expect(created.source).toBe("Manual entry")
    expect(created.activities.map((item) => item.type)).toEqual(["created"])
  })

  it("accepts an existing assignee and rejects an unknown one", async () => {
    const ok = await createAsAdmin({ assigneeId: memberId })
    expect(ok.res.status).toBe(201)
    expect((ok.body.lead as unknown as { assigneeId: string }).assigneeId).toBe(memberId)

    const missing = await createAsAdmin({ assigneeId: randomUUID() })
    expect(missing.res.status).toBe(400)
    expect(missing.body.error).toBe("Assignee not found")
  })

  it("maps an unknown stage id to the first pipeline stage", async () => {
    const { res, body } = await createAsAdmin({ stage: "not-a-real-stage" })
    expect(res.status).toBe(201)
    expect((body.lead as unknown as { stage: string }).stage).toBe("st-new")
  })

  it("rejects invalid input before writing", async () => {
    asUser(adminSessionId)

    const noName = await createLead(jsonRequest("POST", { firstName: "   " }))
    expect(noName.status).toBe(400)

    const badDate = await createLead(jsonRequest("POST", { firstName: "X", followUp: "2026-02-30" }))
    expect(badDate.status).toBe(400)

    const negative = await createLead(jsonRequest("POST", { firstName: "X", value: -1 }))
    expect(negative.status).toBe(400)

    const tooLong = await createLead(jsonRequest("POST", { firstName: "X".repeat(81) }))
    expect(tooLong.status).toBe(400)
  })
})

describe("PATCH /api/leads/:id", () => {
  it("moves the lead, logs the stage change and marks a closed stage", async () => {
    const { body } = await createAsAdmin({ firstName: "Stage" })
    const id = (body.lead as unknown as { id: string }).id

    asUser(adminSessionId)
    const moved = await patchLead(jsonRequest("PATCH", { stage: "st-contacted" }), params(id))
    expect(moved.status).toBe(200)
    const movedBody = (await moved.json()) as { lead: { stage: string; closedAt: string | null; activities: { text: string; authorName: string }[] } }
    expect(movedBody.lead.stage).toBe("st-contacted")
    expect(movedBody.lead.closedAt).toBeNull()
    expect(movedBody.lead.activities.some((item) => item.text === "New Lead → Contacted")).toBe(true)

    const won = await patchLead(jsonRequest("PATCH", { stage: "st-won" }), params(id))
    const wonBody = (await won.json()) as { lead: { closedAt: string | null } }
    expect(wonBody.lead.closedAt).not.toBeNull()

    const reopened = await patchLead(jsonRequest("PATCH", { stage: "st-new" }), params(id))
    const reopenedBody = (await reopened.json()) as { lead: { closedAt: string | null } }
    expect(reopenedBody.lead.closedAt).toBeNull()
  })

  it("rejects a stage id that isn't in the mirrored pipeline", async () => {
    const { body } = await createAsAdmin({ firstName: "Unknown stage" })
    const id = (body.lead as unknown as { id: string }).id

    asUser(adminSessionId)
    const res = await patchLead(jsonRequest("PATCH", { stage: "ghost-stage" }), params(id))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: "Unknown pipeline stage" })

    const after = await patchLead(jsonRequest("PATCH", { firstName: "Still here" }), params(id))
    expect((await after.json()) as { lead: { stage: string } }).toMatchObject({ lead: { stage: "st-new" } })
  })

  it("rejects an unknown assignee", async () => {
    const { body } = await createAsAdmin({ firstName: "Assignee" })
    const id = (body.lead as unknown as { id: string }).id

    asUser(adminSessionId)
    const res = await patchLead(jsonRequest("PATCH", { assigneeId: randomUUID() }), params(id))
    expect(res.status).toBe(400)
  })

  it("returns the unchanged lead for an empty payload and 404s unknown ids", async () => {
    const { body } = await createAsAdmin({ firstName: "Empty" })
    const id = (body.lead as unknown as { id: string }).id

    asUser(adminSessionId)
    const empty = await patchLead(jsonRequest("PATCH", {}), params(id))
    expect(empty.status).toBe(200)
    expect((await empty.json()) as { lead: { id: string } }).toMatchObject({ lead: { id } })

    expect((await patchLead(jsonRequest("PATCH", { firstName: "X" }), params(randomUUID()))).status).toBe(404)
  })

  it("soft-deletes once, then 404s and disappears from the list", async () => {
    const { body } = await createAsAdmin({ firstName: "Delete me" })
    const id = (body.lead as unknown as { id: string }).id

    asUser(adminSessionId)
    const deleted = await deleteLead(jsonRequest("DELETE"), params(id))
    expect(deleted.status).toBe(200)
    expect((await deleteLead(jsonRequest("DELETE"), params(id))).status).toBe(404)

    const list = await listLeads()
    const listBody = (await list.json()) as { leads: { id: string }[] }
    expect(listBody.leads.some((lead) => lead.id === id)).toBe(false)

    /* a soft-deleted lead must not be editable either */
    expect((await patchLead(jsonRequest("PATCH", { firstName: "Zombie" }), params(id))).status).toBe(404)
  })
})

describe("POST /api/leads/:id/activities", () => {
  it("logs an activity and rejects empty text", async () => {
    const { body } = await createAsAdmin({ firstName: "Activity" })
    const id = (body.lead as unknown as { id: string }).id

    asUser(adminSessionId)
    const added = await addActivity(jsonRequest("POST", { type: "call", text: "Left a voicemail" }), params(id))
    expect(added.status).toBe(201)
    const addedBody = (await added.json()) as { lead: { activities: { type: string; text: string }[] } }
    expect(addedBody.lead.activities.at(-1)).toMatchObject({ type: "call", text: "Left a voicemail" })

    expect((await addActivity(jsonRequest("POST", { type: "call", text: "  " }), params(id))).status).toBe(400)
    expect((await addActivity(jsonRequest("POST", { type: "telepathy", text: "hi" }), params(id))).status).toBe(400)
  })
})

describe("POST /api/leads/sync", () => {
  it("reports a disconnected integration as 503", async () => {
    asUser(adminSessionId)
    syncMock.syncLeadsFromGhl.mockResolvedValue({ connected: false, scanned: 0, created: 0, updated: 0 })

    const res = await syncLeads()
    expect(res.status).toBe(503)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining("not connected") })
  })

  it("reports a GHL failure as 502 and a success with counts", async () => {
    asUser(adminSessionId)

    syncMock.syncLeadsFromGhl.mockResolvedValue({
      connected: true,
      scanned: 0,
      created: 0,
      updated: 0,
      error: "GHL said no",
    })
    const failed = await syncLeads()
    expect(failed.status).toBe(502)
    await expect(failed.json()).resolves.toMatchObject({ error: "GHL said no", connected: true })

    syncMock.syncLeadsFromGhl.mockResolvedValue({ connected: true, scanned: 5, created: 2, updated: 3 })
    const ok = await syncLeads()
    expect(ok.status).toBe(200)
    await expect(ok.json()).resolves.toMatchObject({ scanned: 5, created: 2, updated: 3 })
  })
})
