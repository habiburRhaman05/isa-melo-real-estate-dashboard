import { env } from "@/env.mjs"

/* GoHighLevel API (services.leadconnectorhq.com).
   Auth: Private Integration Token as a bearer token. Media uploads are scoped
   to the token's sub-account, but contacts/opportunities/pipelines need the
   location id as a query/body parameter. */
const GHL_API_BASE = "https://services.leadconnectorhq.com"
const GHL_API_VERSION = "2021-07-28"

export type GhlUploadResult = {
  fileId: string
  url: string
}

export class GhlMediaError extends Error {
  constructor(
    message: string,
    public status: number,
    /* GHL's machine-readable error code (e.g. "INVALID_FILE_TYPE"), when it sends one */
    public code?: string,
  ) {
    super(message)
    this.name = "GhlMediaError"
  }
}

export class GhlApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message)
    this.name = "GhlApiError"
  }
}

function requireToken(): string {
  const token = env.GHL_PIT_TOKEN
  if (!token) throw new GhlApiError("GHL_PIT_TOKEN is not configured", 500)
  return token
}

export function getGhlLocationId(): string {
  const locationId = env.GHL_LOCATION_ID
  if (!locationId) throw new GhlApiError("GHL_LOCATION_ID is not configured", 500)
  return locationId
}

/* Contacts/opportunities can only sync when both the token and the sub-account
   id are present; the dashboard keeps working locally otherwise. */
export function isGhlConfigured(): boolean {
  return Boolean(env.GHL_PIT_TOKEN && env.GHL_LOCATION_ID)
}

async function ghlRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined && !(init.body instanceof FormData)
  const res = await fetch(`${GHL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireToken()}`,
      Version: GHL_API_VERSION,
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    let message = detail
    let code: string | undefined
    try {
      const parsed = JSON.parse(detail) as { message?: string; code?: string }
      if (parsed.message) message = parsed.message
      code = parsed.code
    } catch {
      /* not JSON, use the raw text as-is */
    }
    throw new GhlApiError(message || `GHL request failed (${res.status})`, res.status, code)
  }

  return (await res.json()) as T
}

/* ---------- media ---------- */

/* Uploads a file's bytes directly to GHL media storage. */
export async function uploadMediaFile(file: File, name?: string): Promise<GhlUploadResult> {
  const form = new FormData()
  form.set("file", file, name ?? file.name)

  return postUpload(form)
}

/* Imports a file already hosted at a public URL into GHL media storage. */
export async function uploadMediaFromUrl(fileUrl: string, name: string): Promise<GhlUploadResult> {
  const form = new FormData()
  form.set("hosted", "true")
  form.set("fileUrl", fileUrl)
  form.set("name", name)

  return postUpload(form)
}

async function postUpload(form: FormData): Promise<GhlUploadResult> {
  const res = await fetch(`${GHL_API_BASE}/medias/upload-file`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireToken()}`,
      Version: GHL_API_VERSION,
    },
    body: form,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    /* GHL's error body is JSON ({status,message,code,...}) on the failures we've
       seen (bad file type, oversized file); fall back to the raw text when it isn't. */
    let message = detail
    let code: string | undefined
    try {
      const parsed = JSON.parse(detail) as { message?: string; code?: string }
      if (parsed.message) message = parsed.message
      code = parsed.code
    } catch {
      /* not JSON, use the raw text as-is */
    }
    throw new GhlMediaError(message || `GHL media upload failed (${res.status})`, res.status, code)
  }

  const data = (await res.json()) as GhlUploadResult
  return data
}

/* ---------- pipelines ---------- */

export type GhlPipelineStage = {
  id: string
  name: string
  position?: number
}

export type GhlPipeline = {
  id: string
  name: string
  stages: GhlPipelineStage[]
}

export async function listPipelines(): Promise<GhlPipeline[]> {
  const query = new URLSearchParams({ locationId: getGhlLocationId() })
  const data = await ghlRequest<{ pipelines?: GhlPipeline[] }>(
    `/opportunities/pipelines?${query.toString()}`,
  )
  return data.pipelines ?? []
}

/* ---------- contacts ---------- */

export type GhlContact = {
  id: string
  locationId?: string
  firstName?: string | null
  lastName?: string | null
  name?: string | null
  email?: string | null
  phone?: string | null
  address1?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  postalCode?: string | null
  companyName?: string | null
  source?: string | null
  dateAdded?: string | null
}

export type GhlContactInput = {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address1?: string
  country?: string
  companyName?: string
  source?: string
}

export async function listContactsPage(params: {
  limit?: number
  startAfter?: number
  startAfterId?: string
}): Promise<{ contacts: GhlContact[]; count: number }> {
  const query = new URLSearchParams({
    locationId: getGhlLocationId(),
    limit: String(params.limit ?? 100),
  })
  if (params.startAfter) query.set("startAfter", String(params.startAfter))
  if (params.startAfterId) query.set("startAfterId", params.startAfterId)

  const data = await ghlRequest<{ contacts?: GhlContact[]; count?: number }>(
    `/contacts/?${query.toString()}`,
  )
  return { contacts: data.contacts ?? [], count: data.count ?? 0 }
}

export async function getContact(id: string): Promise<GhlContact | null> {
  const data = await ghlRequest<{ contact?: GhlContact }>(`/contacts/${encodeURIComponent(id)}`)
  return data.contact ?? null
}

export async function upsertContact(input: GhlContactInput): Promise<{ contact: GhlContact; created: boolean }> {
  const data = await ghlRequest<{ contact?: GhlContact; new?: boolean }>("/contacts/upsert", {
    method: "POST",
    body: JSON.stringify({ ...compact(input), locationId: getGhlLocationId() }),
  })
  if (!data.contact) throw new GhlApiError("GHL did not return the saved contact", 502)
  return { contact: data.contact, created: data.new ?? false }
}

export async function updateContact(id: string, input: GhlContactInput): Promise<GhlContact> {
  const data = await ghlRequest<{ contact?: GhlContact }>(`/contacts/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(compact(input)),
  })
  return data.contact ?? { id }
}

/* ---------- opportunities ---------- */

export type GhlOpportunityStatus = "open" | "won" | "lost" | "abandoned"

export type GhlOpportunity = {
  id: string
  name?: string
  pipelineId?: string
  pipelineStageId?: string
  status?: GhlOpportunityStatus
  contactId?: string
  monetaryValue?: number
  assignedTo?: string
  createdAt?: string
  updatedAt?: string
}

export async function searchOpportunities(params: {
  pipelineId?: string
  contactId?: string
  limit?: number
  page?: number
}): Promise<GhlOpportunity[]> {
  const query = new URLSearchParams({
    locationId: getGhlLocationId(),
    limit: String(params.limit ?? 100),
    page: String(params.page ?? 1),
  })
  if (params.pipelineId) query.set("pipelineId", params.pipelineId)
  if (params.contactId) query.set("contactId", params.contactId)

  const data = await ghlRequest<{ opportunities?: GhlOpportunity[] }>(
    `/opportunities/search?${query.toString()}`,
  )
  return data.opportunities ?? []
}

export async function createOpportunity(input: {
  pipelineId: string
  pipelineStageId: string
  contactId: string
  name: string
  status: GhlOpportunityStatus
  monetaryValue: number
}): Promise<GhlOpportunity> {
  const data = await ghlRequest<{ opportunity?: GhlOpportunity }>("/opportunities/", {
    method: "POST",
    body: JSON.stringify({ ...input, locationId: getGhlLocationId() }),
  })
  if (!data.opportunity?.id) throw new GhlApiError("GHL did not return the created opportunity", 502)
  return data.opportunity
}

export async function updateOpportunity(
  id: string,
  input: {
    pipelineId?: string
    pipelineStageId?: string
    name?: string
    status?: GhlOpportunityStatus
    monetaryValue?: number
  },
): Promise<GhlOpportunity> {
  const data = await ghlRequest<{ opportunity?: GhlOpportunity }>(
    `/opportunities/${encodeURIComponent(id)}`,
    { method: "PUT", body: JSON.stringify(compact(input)) },
  )
  return data.opportunity ?? { id }
}

function compact<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  )
}
