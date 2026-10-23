import { eq, inArray, like } from "drizzle-orm"

import { randomUUID } from "node:crypto"

/* The GHL HTTP boundary is faked; everything below it (zod validation, drizzle
   writes, the two-way mapping) is real. */
vi.mock("@/env.mjs", () => ({
  env: {
    GHL_PIT_TOKEN: "pit-test-token",
    GHL_LOCATION_ID: "loc-test",
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
    { id: "st-lost", name: "Closed Lost", color: "#c0364a", bg: "#fbe3e8", fg: "#b32d45" },
  ],
}))

vi.mock("@/lib/ghl-pipeline", () => ({
  getLeadPipeline: async () => PIPELINE,
}))

import { db } from "@/lib/db"
import { leadActivities, leads } from "@/lib/db/schema"
import { handleGhlWebhook, syncGhlContact, syncLeadsFromGhl, syncLeadToGhl } from "@/lib/ghl-sync"

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

const tag = randomUUID().slice(0, 8)

type Call = {
  path: string
  method: string
  body: Record<string, unknown> | undefined
  headers: Record<string, string>
}

let calls: Call[] = []
let respond: (call: Call) => Response

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

beforeEach(() => {
  calls = []
  respond = () => json({})
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
      const url = new URL(raw)
      const call: Call = {
        path: url.pathname,
        method: init?.method ?? "GET",
        body:
          typeof init?.body === "string"
            ? (JSON.parse(init.body) as Record<string, unknown>)
            : undefined,
        headers: Object.fromEntries(new Headers(init?.headers).entries()),
      }
      calls.push(call)
      return respond(call)
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

afterAll(async () => {
  const rows = await db.select({ id: leads.id }).from(leads).where(like(leads.email, `%${tag}%`))
  if (rows.length > 0) {
    await db.delete(leadActivities).where(inArray(leadActivities.leadId, rows.map((row) => row.id)))
  }
  await db.delete(leads).where(like(leads.email, `%${tag}%`))
})

async function makeLead(overrides: Partial<typeof leads.$inferInsert> = {}) {
  const [row] = await db
    .insert(leads)
    .values({
      firstName: "Layla",
      lastName: "Haddad",
      email: `layla-${tag}@ghl-it.local`,
      phone: `+97150${tag.slice(0, 5)}`,
      business: "Skyline Realty",
      address: "Marina Gate 2",
      country: "UAE",
      stage: "st-new",
      value: "0",
      source: "Website",
      ...overrides,
    })
    .returning()
  return row!
}

let contactSeq = 0

function contact(overrides: Record<string, unknown> = {}) {
  contactSeq += 1
  const slug = String(overrides.id ?? `c-${tag}`).replace(/[^a-z0-9]/gi, "")
  return {
    id: `c-${tag}`,
    firstName: "Omar",
    lastName: "Haddad",
    email: `${slug}-${tag}@ghl-it.local`,
    phone: `+971${String(contactSeq).padStart(9, "0")}`,
    companyName: "Skyline Realty",
    address1: "Marina Gate 2",
    country: "UAE",
    source: "Website",
    dateAdded: new Date().toISOString(),
    ...overrides,
  }
}

describe("dashboard -> GoHighLevel", () => {
  it("creates the contact and its opportunity, then stores both GHL ids", async () => {
    respond = (call) => {
      if (call.path === "/contacts/upsert") {
        return json({ contact: { id: `c-out-${tag}` }, new: true })
      }
      if (call.path === "/opportunities/") {
        return json({ opportunity: { id: `o-out-${tag}` } })
      }
      return json({})
    }

    const lead = await makeLead({ value: "500000" })
    const result = await syncLeadToGhl(lead)

    expect(result).toMatchObject({ skipped: false, contactId: `c-out-${tag}`, opportunityId: `o-out-${tag}` })

    const upsert = calls.find((call) => call.path === "/contacts/upsert")!
    expect(upsert.method).toBe("POST")
    expect(upsert.headers.authorization).toBe("Bearer pit-test-token")
    expect(upsert.headers.version).toBe("2021-07-28")
    expect(upsert.body).toMatchObject({
      firstName: "Layla",
      lastName: "Haddad",
      email: lead.email,
      phone: lead.phone,
      address1: "Marina Gate 2",
      country: "UAE",
      companyName: "Skyline Realty",
      source: "Website",
      locationId: "loc-test",
    })

    const opportunity = calls.find((call) => call.path === "/opportunities/")!
    expect(opportunity.body).toMatchObject({
      pipelineId: "pipe-test",
      pipelineStageId: "st-new",
      contactId: `c-out-${tag}`,
      name: "Layla Haddad",
      status: "open",
      monetaryValue: 500000,
      locationId: "loc-test",
    })

    const saved = await db.query.leads.findFirst({ where: eq(leads.id, lead.id) })
    expect(saved).toMatchObject({ ghlContactId: `c-out-${tag}`, ghlOpportunityId: `o-out-${tag}` })
  })

  it("updates the linked contact and opportunity instead of creating duplicates", async () => {
    respond = (call) => {
      if (call.method === "PUT" && call.path.startsWith("/contacts/")) return json({ contact: { id: "c-upd" } })
      if (call.method === "PUT" && call.path.startsWith("/opportunities/")) {
        return json({ opportunity: { id: "o-upd" } })
      }
      return json({})
    }

    const lead = await makeLead({
      stage: "st-won",
      value: "900000",
      ghlContactId: `c-upd-${tag}`,
      ghlOpportunityId: `o-upd-${tag}`,
    })

    const result = await syncLeadToGhl(lead)
    expect(result).toMatchObject({ skipped: false, contactId: `c-upd-${tag}`, opportunityId: `o-upd-${tag}` })

    expect(calls.some((call) => call.path === "/contacts/upsert")).toBe(false)
    expect(calls.some((call) => call.path === "/opportunities/" && call.method === "POST")).toBe(false)

    const opportunity = calls.find((call) => call.path === `/opportunities/o-upd-${tag}`)!
    expect(opportunity.body).toMatchObject({
      pipelineId: "pipe-test",
      pipelineStageId: "st-won",
      status: "won",
      monetaryValue: 900000,
    })
  })

  it("marks a lost stage as lost in GHL", async () => {
    respond = (call) => {
      if (call.path === "/contacts/upsert") return json({ contact: { id: `c-lost-${tag}` }, new: true })
      if (call.path === "/opportunities/") return json({ opportunity: { id: `o-lost-${tag}` } })
      return json({})
    }

    const lead = await makeLead({ stage: "st-lost" })
    await syncLeadToGhl(lead)

    const opportunity = calls.find((call) => call.path === "/opportunities/")!
    expect(opportunity.body?.status).toBe("lost")
  })

  it("recreates the contact when it was deleted in GHL (404 on update)", async () => {
    respond = (call) => {
      if (call.method === "PUT" && call.path.startsWith("/contacts/")) {
        return json({ message: "Contact not found" }, 404)
      }
      if (call.path === "/contacts/upsert") return json({ contact: { id: `c-reborn-${tag}` }, new: true })
      if (call.path === "/opportunities/") return json({ opportunity: { id: `o-reborn-${tag}` } })
      return json({})
    }

    const lead = await makeLead({ ghlContactId: `c-gone-${tag}` })
    const result = await syncLeadToGhl(lead)

    expect(result).toMatchObject({ contactId: `c-reborn-${tag}`, opportunityId: `o-reborn-${tag}` })
    expect(calls.filter((call) => call.path === "/contacts/upsert")).toHaveLength(1)

    const saved = await db.query.leads.findFirst({ where: eq(leads.id, lead.id) })
    expect(saved?.ghlContactId).toBe(`c-reborn-${tag}`)
  })

  it("reports a GHL failure without losing the local lead", async () => {
    respond = () => json({ message: "boom" }, 500)

    const lead = await makeLead()
    const result = await syncLeadToGhl(lead)

    expect(result.skipped).toBe(false)
    expect(result.error).toBe("boom")
    expect(result.contactId).toBeUndefined()
    expect(calls.some((call) => call.path === "/opportunities/")).toBe(false)

    const saved = await db.query.leads.findFirst({ where: eq(leads.id, lead.id) })
    expect(saved?.firstName).toBe("Layla")
    expect(saved?.ghlContactId).toBeNull()
  })
})

describe("GoHighLevel -> dashboard", () => {
  it("imports new contacts and updates existing leads, including their stage", async () => {
    const existing = await makeLead({
      firstName: "Old",
      email: `existing-${tag}@ghl-it.local`,
      stage: "st-new",
    })

    respond = (call) => {
      if (call.path === "/contacts/") {
        return json({
          count: 2,
          contacts: [
            contact({ id: `c-new-${tag}` }),
            contact({
              id: `c-ex-${tag}`,
              firstName: "Updated",
              email: `existing-${tag}@ghl-it.local`,
              phone: `+97155${tag.slice(0, 5)}`,
            }),
          ],
        })
      }
      if (call.path === "/opportunities/search") {
        return json({
          opportunities: [
            {
              id: `o-new-${tag}`,
              contactId: `c-new-${tag}`,
              pipelineStageId: "st-contacted",
              status: "open",
              monetaryValue: 750000,
            },
            {
              id: `o-ex-${tag}`,
              contactId: `c-ex-${tag}`,
              pipelineStageId: "st-won",
              status: "won",
              monetaryValue: 900000,
            },
          ],
        })
      }
      return json({})
    }

    const result = await syncLeadsFromGhl()
    expect(result).toMatchObject({ connected: true, scanned: 2, created: 1, updated: 1 })

    const imported = await db.query.leads.findFirst({ where: eq(leads.ghlContactId, `c-new-${tag}`) })
    expect(imported).toMatchObject({
      firstName: "Omar",
      lastName: "Haddad",
      stage: "st-contacted",
      value: "750000.00",
      country: "UAE",
      ghlOpportunityId: `o-new-${tag}`,
    })

    const refreshed = await db.query.leads.findFirst({ where: eq(leads.id, existing.id) })
    expect(refreshed).toMatchObject({
      firstName: "Updated",
      stage: "st-won",
      ghlContactId: `c-ex-${tag}`,
      ghlOpportunityId: `o-ex-${tag}`,
    })
    expect(refreshed?.closedAt).toBeInstanceOf(Date)
    expect(refreshed?.closedAt?.getTime()).toBeGreaterThan(Date.now() - 60_000)

    const activity = await db.query.leadActivities.findFirst({
      where: eq(leadActivities.leadId, existing.id),
    })
    expect(activity).toMatchObject({
      type: "stage",
      authorName: "GoHighLevel",
      text: "New Lead → Closed Won",
    })
  })

  it("is idempotent: a second pull updates instead of duplicating", async () => {
    respond = (call) => {
      if (call.path === "/contacts/") {
        return json({ count: 1, contacts: [contact({ id: `c-idem-${tag}` })] })
      }
      if (call.path === "/opportunities/search") {
        return json({
          opportunities: [
            { id: `o-idem-${tag}`, contactId: `c-idem-${tag}`, pipelineStageId: "st-new", status: "open" },
          ],
        })
      }
      return json({})
    }

    expect(await syncLeadsFromGhl()).toMatchObject({ created: 1, updated: 0 })
    expect(await syncLeadsFromGhl()).toMatchObject({ created: 0, updated: 1 })

    const all = await db.select().from(leads).where(eq(leads.ghlContactId, `c-idem-${tag}`))
    expect(all).toHaveLength(1)
  })

  it("parks a contact with no opportunity in the first pipeline stage", async () => {
    respond = (call) => {
      if (call.path === "/contacts/") {
        return json({ count: 1, contacts: [contact({ id: `c-noopp-${tag}`, email: `noopp-${tag}@ghl-it.local` })] })
      }
      if (call.path === "/opportunities/search") return json({ opportunities: [] })
      return json({})
    }

    await syncLeadsFromGhl()

    const imported = await db.query.leads.findFirst({ where: eq(leads.ghlContactId, `c-noopp-${tag}`) })
    expect(imported?.stage).toBe("st-new")
  })

  it("matches an existing lead by phone when the contact has no email", async () => {
    const phone = `+97156${tag.slice(0, 5)}9`
    const existing = await makeLead({ email: "", phone, stage: "st-contacted" })

    respond = (call) => {
      if (call.path === "/contacts/") {
        return json({ count: 1, contacts: [contact({ id: `c-phone-${tag}`, email: null, phone })] })
      }
      if (call.path === "/opportunities/search") return json({ opportunities: [] })
      return json({})
    }

    const result = await syncLeadsFromGhl()
    expect(result).toMatchObject({ created: 0, updated: 1 })

    const refreshed = await db.query.leads.findFirst({ where: eq(leads.id, existing.id) })
    expect(refreshed?.ghlContactId).toBe(`c-phone-${tag}`)
  })

  it("refreshes a single contact by id, for webhooks", async () => {
    respond = (call) => {
      if (call.path === `/contacts/c-single-${tag}`) {
        return json({ contact: contact({ id: `c-single-${tag}`, email: `single-${tag}@ghl-it.local` }) })
      }
      if (call.path === "/opportunities/search") {
        return json({
          opportunities: [
            {
              id: `o-single-${tag}`,
              contactId: `c-single-${tag}`,
              pipelineStageId: "st-contacted",
              status: "open",
            },
          ],
        })
      }
      return json({})
    }

    const result = await syncGhlContact(`c-single-${tag}`)
    expect(result).toMatchObject({ connected: true, scanned: 1, created: 1, updated: 0 })

    const imported = await db.query.leads.findFirst({ where: eq(leads.ghlContactId, `c-single-${tag}`) })
    expect(imported?.stage).toBe("st-contacted")
  })

  it("returns a zero result when the contact no longer exists", async () => {
    respond = () => json({ message: "not found" }, 404)

    const result = await syncGhlContact(`c-missing-${tag}`)
    expect(result).toMatchObject({ connected: true, scanned: 0, created: 0, updated: 0 })
    expect(result.error).toContain("not found")
  })
})

describe("handleGhlWebhook", () => {
  beforeEach(() => {
    respond = (call) => {
      const id = call.path.replace("/contacts/", "")
      if (call.path.startsWith("/contacts/")) {
        return json({ contact: contact({ id, email: `${id}@ghl-it.local` }) })
      }
      if (call.path === "/opportunities/search") return json({ opportunities: [] })
      return json({})
    }
  })

  it("accepts the marketplace envelope", async () => {
    const result = await handleGhlWebhook({ type: "ContactCreate", data: { contactId: `h-env-${tag}` } })
    expect(result).toMatchObject({ scanned: 1, created: 1 })
  })

  it("accepts the flat workflow-webhook payload and nested contact objects", async () => {
    expect(await handleGhlWebhook({ contactId: `h-flat-${tag}` })).toMatchObject({ created: 1 })
    expect(await handleGhlWebhook({ id: `h-id-${tag}` })).toMatchObject({ created: 1 })
    expect(await handleGhlWebhook({ data: { contact: { id: `h-nested-${tag}` } } })).toMatchObject({ created: 1 })
  })

  it("ignores payloads without a contact id", async () => {
    expect(await handleGhlWebhook({ type: "OpportunityUpdate", data: {} })).toBeNull()
    expect(await handleGhlWebhook(null)).toBeNull()
    expect(await handleGhlWebhook("nope")).toBeNull()
  })
})

