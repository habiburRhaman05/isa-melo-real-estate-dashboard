import { and, eq, isNull, or, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { type Lead, leadActivities, leads } from "@/lib/db/schema"
import {
  createOpportunity,
  getContact,
  GhlApiError,
  type GhlContact,
  type GhlContactInput,
  type GhlOpportunity,
  type GhlOpportunityStatus,
  isGhlConfigured,
  listContactsPage,
  searchOpportunities,
  updateContact,
  updateOpportunity,
  upsertContact,
} from "@/lib/ghl"
import { getLeadPipeline, type LeadPipeline } from "@/lib/ghl-pipeline"
import { isClosedStage, leadName, stageInfo } from "@/lib/leads"

export type GhlSyncOutcome = {
  skipped: boolean
  contactId?: string
  opportunityId?: string
  error?: string
}

export type GhlPullResult = {
  connected: boolean
  scanned: number
  created: number
  updated: number
  error?: string
}

function contactInput(lead: Lead): GhlContactInput {
  return {
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    address1: lead.address,
    country: lead.country,
    companyName: lead.business,
    source: lead.source || "Dashboard",
  }
}

function opportunityInput(lead: Lead, pipeline: LeadPipeline) {
  const stageId = pipeline.stages.some((stage) => stage.id === lead.stage)
    ? lead.stage
    : (pipeline.stages[0]?.id ?? lead.stage)
  const closed = isClosedStage(lead.stage, pipeline.stages)
  const status: GhlOpportunityStatus = !closed
    ? "open"
    : /lost|abandon/i.test(stageInfo(lead.stage, pipeline.stages).name)
      ? "lost"
      : "won"

  return {
    pipelineId: pipeline.id ?? undefined,
    pipelineStageId: stageId,
    name: leadName(lead) || lead.email || lead.phone || "Website lead",
    status,
    monetaryValue: Number(lead.value) || 0,
  }
}

/* Pushes one dashboard lead to GHL: contact first, then its opportunity in the
   mirrored pipeline. Returns the ids so the caller can persist them; a GHL
   failure is reported, never thrown, so the local write is not lost. */
export async function syncLeadToGhl(lead: Lead): Promise<GhlSyncOutcome> {
  if (!isGhlConfigured()) return { skipped: true }

  try {
    const pipeline = await getLeadPipeline()

    let contactId = lead.ghlContactId
    if (contactId) {
      try {
        await updateContact(contactId, contactInput(lead))
      } catch (error) {
        /* the contact was deleted in GHL after we stored its id; recreate it
           instead of failing this lead's sync forever */
        if (!(error instanceof GhlApiError) || error.status !== 404) throw error
        const { contact } = await upsertContact(contactInput(lead))
        contactId = contact.id
        await db.update(leads).set({ ghlContactId: contactId }).where(eq(leads.id, lead.id))
      }
    } else {
      const { contact } = await upsertContact(contactInput(lead))
      contactId = contact.id
      /* save the link before touching the opportunity, so a failed opportunity
         call does not leave the next attempt creating a second contact */
      await db.update(leads).set({ ghlContactId: contactId }).where(eq(leads.id, lead.id))
    }

    let opportunityId = lead.ghlOpportunityId
    if (pipeline.id) {
      const payload = opportunityInput(lead, pipeline)
      if (opportunityId) {
        await updateOpportunity(opportunityId, payload)
      } else {
        const opportunity = await createOpportunity({ ...payload, contactId, pipelineId: pipeline.id })
        opportunityId = opportunity.id
      }
    }

    if (contactId !== lead.ghlContactId || opportunityId !== lead.ghlOpportunityId) {
      await db.update(leads).set({ ghlContactId: contactId, ghlOpportunityId: opportunityId ?? null }).where(eq(leads.id, lead.id))
    }

    return { skipped: false, contactId: contactId ?? undefined, opportunityId: opportunityId ?? undefined }
  } catch (error) {
    return {
      skipped: false,
      error: error instanceof Error ? error.message : "GoHighLevel sync failed",
    }
  }
}

/* ---------- GHL -> dashboard ---------- */

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || ""
}

function splitName(contact: GhlContact) {
  const full = contact.name?.trim() ?? ""
  if (!full) return { first: "", last: "" }
  const [first, ...rest] = full.split(/\s+/)
  return { first: first ?? "", last: rest.join(" ") }
}

function pickGhl(next: string | null | undefined, current: string | undefined) {
  const value = next?.trim()
  return value ? value : (current ?? "")
}

async function findExistingLead(contact: GhlContact) {
  const clauses = [eq(leads.ghlContactId, contact.id)]
  const email = normalizeEmail(contact.email)
  if (email) clauses.push(sql`lower(${leads.email}) = ${email}`)
  if (contact.phone?.trim()) clauses.push(eq(leads.phone, contact.phone.trim()))

  return db.query.leads.findFirst({
    where: and(isNull(leads.deletedAt), or(...clauses)),
  })
}

async function upsertLeadFromContact(
  contact: GhlContact,
  opportunity: GhlOpportunity | undefined,
  pipeline: LeadPipeline,
): Promise<"created" | "updated" | "skipped"> {
  const existing = await findExistingLead(contact)
  const nameParts = splitName(contact)
  const oppStage =
    opportunity?.pipelineStageId && pipeline.stages.some((stage) => stage.id === opportunity.pipelineStageId)
      ? opportunity.pipelineStageId
      : undefined
  const stage = oppStage ?? existing?.stage ?? pipeline.stages[0]?.id ?? "new"
  const closed =
    (opportunity?.status !== undefined && opportunity.status !== "open") || isClosedStage(stage, pipeline.stages)

  const mapped = {
    firstName: pickGhl(contact.firstName, existing?.firstName) || nameParts.first || "Unknown",
    lastName: pickGhl(contact.lastName, existing?.lastName) || nameParts.last,
    phone: pickGhl(contact.phone, existing?.phone),
    email: pickGhl(normalizeEmail(contact.email), existing?.email),
    business: pickGhl(contact.companyName, existing?.business),
    address: pickGhl(contact.address1, existing?.address),
    country: pickGhl(contact.country, existing?.country),
    source: pickGhl(contact.source, existing?.source) || "GoHighLevel",
    stage,
    value:
      typeof opportunity?.monetaryValue === "number"
        ? String(opportunity.monetaryValue)
        : (existing?.value ?? "0"),
    ghlContactId: contact.id,
    ghlOpportunityId: opportunity?.id ?? existing?.ghlOpportunityId ?? null,
    closedAt: closed ? (existing?.closedAt ?? new Date()) : null,
  }

  if (!existing) {
    const [created] = await db.insert(leads).values(mapped).returning()
    if (!created) return "skipped"

    await db.insert(leadActivities).values({
      leadId: created.id,
      type: "created",
      authorId: null,
      authorName: "GoHighLevel",
      text: "Contact imported from GoHighLevel",
    })
    return "created"
  }

  await db.update(leads).set(mapped).where(eq(leads.id, existing.id))

  if (existing.stage !== mapped.stage) {
    await db.insert(leadActivities).values({
      leadId: existing.id,
      type: "stage",
      authorId: null,
      authorName: "GoHighLevel",
      text: `${stageInfo(existing.stage, pipeline.stages).name} → ${stageInfo(mapped.stage, pipeline.stages).name}`,
    })
  }

  return "updated"
}

async function fetchAllContacts(): Promise<GhlContact[]> {
  const byId = new Map<string, GhlContact>()
  let startAfter: number | undefined
  let startAfterId: string | undefined

  for (let page = 0; page < 20; page += 1) {
    const result = await listContactsPage({ limit: 100, startAfter, startAfterId })
    if (result.contacts.length === 0) break

    for (const contact of result.contacts) byId.set(contact.id, contact)
    if (result.contacts.length < 100) break

    const last = result.contacts[result.contacts.length - 1]!
    const timestamp = last.dateAdded ? Date.parse(last.dateAdded) : Number.NaN
    if (!Number.isFinite(timestamp) || last.id === startAfterId) break
    startAfter = timestamp
    startAfterId = last.id
  }

  return Array.from(byId.values())
}

async function fetchAllOpportunities(pipelineId: string): Promise<GhlOpportunity[]> {
  const byId = new Map<string, GhlOpportunity>()

  for (let page = 1; page <= 10; page += 1) {
    const batch = await searchOpportunities({ pipelineId, limit: 100, page })
    for (const opportunity of batch) byId.set(opportunity.id, opportunity)
    if (batch.length < 100) break
  }

  return Array.from(byId.values())
}

/* Pulls every GHL contact in the sub-account (and its opportunity in the
   mirrored pipeline) into the dashboard. Used by the Sync button, on page
   load, and by the inbound webhook for a single contact. */
export async function syncLeadsFromGhl(): Promise<GhlPullResult> {
  if (!isGhlConfigured()) return { connected: false, scanned: 0, created: 0, updated: 0 }

  try {
    const pipeline = await getLeadPipeline()
    const contacts = await fetchAllContacts()
    const opportunities = pipeline.id ? await fetchAllOpportunities(pipeline.id) : []

    const byContact = new Map<string, GhlOpportunity>()
    for (const opportunity of opportunities) {
      if (opportunity.contactId && !byContact.has(opportunity.contactId)) {
        byContact.set(opportunity.contactId, opportunity)
      }
    }

    let created = 0
    let updated = 0
    for (const contact of contacts) {
      const result = await upsertLeadFromContact(contact, byContact.get(contact.id), pipeline)
      if (result === "created") created += 1
      if (result === "updated") updated += 1
    }

    return { connected: true, scanned: contacts.length, created, updated }
  } catch (error) {
    return {
      connected: true,
      scanned: 0,
      created: 0,
      updated: 0,
      error: error instanceof Error ? error.message : "GoHighLevel sync failed",
    }
  }
}

/* Refreshes a single contact, for webhook events that only carry a contact id. */
export async function syncGhlContact(contactId: string): Promise<GhlPullResult> {
  if (!isGhlConfigured()) return { connected: false, scanned: 0, created: 0, updated: 0 }

  try {
    const pipeline = await getLeadPipeline()
    const contact = await getContact(contactId)
    if (!contact) return { connected: true, scanned: 0, created: 0, updated: 0 }

    const opportunities = pipeline.id
      ? await searchOpportunities({ pipelineId: pipeline.id, contactId, limit: 10 })
      : []
    const result = await upsertLeadFromContact(contact, opportunities[0], pipeline)

    return {
      connected: true,
      scanned: 1,
      created: result === "created" ? 1 : 0,
      updated: result === "updated" ? 1 : 0,
    }
  } catch (error) {
    return {
      connected: true,
      scanned: 0,
      created: 0,
      updated: 0,
      error: error instanceof Error ? error.message : "GoHighLevel sync failed",
    }
  }
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

/* Accepts the marketplace webhook envelope ({type,data}) and the flatter
   payload a GHL workflow Custom Webhook sends. */
export async function handleGhlWebhook(payload: unknown): Promise<GhlPullResult | null> {
  if (!payload || typeof payload !== "object") return null
  const body = payload as Record<string, unknown>
  const data = (body.data && typeof body.data === "object" ? body.data : body) as Record<string, unknown>
  const contact = (data.contact && typeof data.contact === "object" ? data.contact : {}) as Record<string, unknown>

  const contactId =
    text(data.contactId) ??
    text(contact.id) ??
    text(data.contact_id) ??
    text(data.id)

  if (!contactId) return null
  return syncGhlContact(contactId)
}
