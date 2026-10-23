import { and, eq, isNull, notInArray } from "drizzle-orm"

import { env } from "@/env.mjs"
import { db } from "@/lib/db"
import { getSetting, setSetting } from "@/lib/db/queries"
import { leads } from "@/lib/db/schema"
import { type GhlPipelineStage, isGhlConfigured, listPipelines } from "@/lib/ghl"
import { LEAD_PIPELINE_STAGES, type LeadPipelineStage } from "@/lib/leads"

/* The dashboard mirrors one GHL pipeline into the leads board. The stage list
   is cached in settings so every page render and API write can resolve stage
   ids/names without a GHL round trip. */
export const PIPELINE_SETTING_KEY = "ghl_pipeline"
const CACHE_TTL_MS = 5 * 60 * 1000
export const DEFAULT_PIPELINE_NAME = "Dubai Off Plan Sales"

export type LeadPipeline = {
  id: string | null
  name: string
  stages: LeadPipelineStage[]
  connected: boolean
  syncedAt: number | null
}

type CachedPipeline = {
  id: string
  name: string
  stages: LeadPipelineStage[]
  syncedAt: number
}

/* stage colours for pipelines of any length; the first six match the original
   offline palette so the board looks unchanged for the fallback list. */
const STAGE_PALETTE: { color: string; bg: string; fg: string }[] = [
  { color: "#a99bd0", bg: "#ece4fa", fg: "#6b5f8a" },
  { color: "#5a2d9c", bg: "#ece4fa", fg: "#5a2d9c" },
  { color: "#d4a02a", bg: "#fbe9c9", fg: "#8a5a0f" },
  { color: "#2a1458", bg: "#e4dff0", fg: "#2a1458" },
  { color: "#2f9e6e", bg: "#d5eadf", fg: "#25704f" },
  { color: "#c0364a", bg: "#fbe3e8", fg: "#b32d45" },
  { color: "#1f7a8c", bg: "#d8eef1", fg: "#175e6b" },
  { color: "#b5651d", bg: "#f8e6d4", fg: "#8a4a12" },
  { color: "#3b6fb6", bg: "#e0e9f7", fg: "#2c548a" },
  { color: "#7a4fb5", bg: "#eee4fa", fg: "#5b348a" },
]

/* preserve the familiar colours for the stages whose meaning is obvious, and
   fall back to the palette by position for everything in between */
function semanticPalette(name: string) {
  const value = name.toLowerCase()
  if (/won|sold|success/.test(value)) return STAGE_PALETTE[4]
  if (/lost|abandon|dead/.test(value)) return STAGE_PALETTE[5]
  if (/new|enquir|inquir/.test(value)) return STAGE_PALETTE[0]
  if (/contact/.test(value)) return STAGE_PALETTE[1]
  return undefined
}

export function mapPipelineStages(stages: GhlPipelineStage[]): LeadPipelineStage[] {
  return [...stages]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((stage, index) => {
      const palette = semanticPalette(stage.name) ?? STAGE_PALETTE[index % STAGE_PALETTE.length]!
      return { id: stage.id, name: stage.name, ...palette }
    })
}

function pipelineName() {
  return env.GHL_PIPELINE_NAME?.trim() || DEFAULT_PIPELINE_NAME
}

/* GHL names pipelines freely ("Dubai Off-Plan Sales" vs "Dubai Off Plan
   Sales"), so match on letters and digits only. */
function normalizePipelineName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function fallbackPipeline(): LeadPipeline {
  return {
    id: null,
    name: "Website leads",
    stages: LEAD_PIPELINE_STAGES,
    connected: isGhlConfigured(),
    syncedAt: null,
  }
}

function validCache(value: unknown): value is CachedPipeline {
  if (!value || typeof value !== "object") return false
  const cache = value as Partial<CachedPipeline>
  return (
    typeof cache.id === "string" &&
    typeof cache.name === "string" &&
    typeof cache.syncedAt === "number" &&
    Array.isArray(cache.stages) &&
    cache.stages.length > 0 &&
    cache.stages.every(
      (stage) => typeof stage?.id === "string" && typeof stage?.name === "string",
    )
  )
}

export function normalizeStageName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

/* Finds the new stage that best matches an old stage id, by the stage name it
   had in the previous pipeline (falling back to the id itself). Exact names
   win, then a looser contains-match such as "Contacted" in "Contacted - Hot".
   Returns undefined when nothing resembles the old stage. */
export function matchStage(
  oldStageId: string,
  previous: LeadPipelineStage[],
  next: LeadPipelineStage[],
): LeadPipelineStage | undefined {
  const oldName = normalizeStageName(previous.find((stage) => stage.id === oldStageId)?.name ?? oldStageId)
  if (!oldName) return undefined

  return (
    next.find((stage) => normalizeStageName(stage.name) === oldName) ??
    next.find((stage) => {
      const name = normalizeStageName(stage.name)
      return Boolean(name) && (name.includes(oldName) || oldName.includes(name))
    })
  )
}

/* Leads created before the pipeline was connected (or sitting in a stage that
   was renamed/removed in GHL) would otherwise fall out of every column. Match
   them to the closest new stage by name and park the rest in the first stage. */
async function remapUnmappedLeads(previous: LeadPipelineStage[], next: LeadPipelineStage[]) {
  const ids = next.map((stage) => stage.id)
  if (ids.length === 0) return

  const stale = await db
    .select({ id: leads.id, stage: leads.stage })
    .from(leads)
    .where(and(isNull(leads.deletedAt), notInArray(leads.stage, ids)))

  for (const lead of stale) {
    const target = matchStage(lead.stage, previous, next)?.id ?? next[0]?.id
    if (target) await db.update(leads).set({ stage: target }).where(eq(leads.id, lead.id))
  }
}

function fromCache(cache: CachedPipeline): LeadPipeline {
  return {
    id: cache.id,
    name: cache.name,
    stages: cache.stages,
    connected: isGhlConfigured(),
    syncedAt: cache.syncedAt,
  }
}

/* Reads the cached stage list, refreshing it from GHL when the cache is stale
   or missing. Never throws: a GHL outage leaves the board on the last good
   stage list (or the offline fallback). */
export async function getLeadPipeline(): Promise<LeadPipeline> {
  let cached: CachedPipeline | null = null
  try {
    const value = await getSetting<unknown>(PIPELINE_SETTING_KEY)
    cached = validCache(value) ? value : null
  } catch {
    /* settings unavailable: fall through to the live fetch/fallback */
  }

  if (cached && Date.now() - cached.syncedAt < CACHE_TTL_MS) return fromCache(cached)
  if (!isGhlConfigured()) return cached ? fromCache(cached) : fallbackPipeline()

  try {
    const pipelines = await listPipelines()
    const wanted = normalizePipelineName(pipelineName())
    const pipeline =
      pipelines.find((item) => normalizePipelineName(item.name) === wanted) ??
      pipelines.find((item) => /dubai/i.test(item.name) && /off/i.test(item.name) && /plan/i.test(item.name)) ??
      pipelines[0]

    const stages = pipeline ? mapPipelineStages(pipeline.stages ?? []) : []
    if (!pipeline || stages.length === 0) {
      throw new Error(`Pipeline "${pipelineName()}" has no stages in GoHighLevel`)
    }

    const fresh: CachedPipeline = {
      id: pipeline.id,
      name: pipeline.name,
      stages,
      syncedAt: Date.now(),
    }
    await setSetting(PIPELINE_SETTING_KEY, fresh, null)
    await remapUnmappedLeads(cached?.stages ?? LEAD_PIPELINE_STAGES, fresh.stages)
    return fromCache(fresh)
  } catch {
    return cached ? fromCache(cached) : fallbackPipeline()
  }
}

export async function getLeadPipelineStages(): Promise<LeadPipelineStage[]> {
  return (await getLeadPipeline()).stages
}
