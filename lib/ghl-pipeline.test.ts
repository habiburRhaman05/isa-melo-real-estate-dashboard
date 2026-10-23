import type { LeadPipelineStage } from "@/lib/leads"
import { LEAD_PIPELINE_STAGES } from "@/lib/leads"

vi.mock("@/env.mjs", () => ({ env: { GHL_PIPELINE_NAME: undefined } }))

const mocks = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  staleLeads: [] as { id: string; stage: string }[],
  updates: [] as Record<string, unknown>[],
  listPipelines: vi.fn(),
  isGhlConfigured: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async () => mocks.staleLeads,
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          mocks.updates.push(values)
        },
      }),
    }),
  },
}))

vi.mock("@/lib/db/queries", () => ({
  getSetting: async (key: string) => mocks.store.get(key) ?? null,
  setSetting: async (key: string, value: unknown) => {
    mocks.store.set(key, value)
  },
}))

vi.mock("@/lib/ghl", () => ({
  isGhlConfigured: mocks.isGhlConfigured,
  listPipelines: mocks.listPipelines,
}))

import {
  getLeadPipeline,
  mapPipelineStages,
  matchStage,
  normalizeStageName,
  PIPELINE_SETTING_KEY,
} from "./ghl-pipeline"

const NOW = 1_760_000_000_000
const FRESH = NOW - 60_000
const STALE = NOW - 10 * 60_000

function stage(id: string, name: string): LeadPipelineStage {
  return { id, name, color: "#111111", bg: "#eeeeee", fg: "#222222" }
}

function cachePipeline(name = "Dubai Off Plan Sales") {
  const stages = [stage("st-new", "New Lead"), stage("st-contacted", "Contacted")]
  mocks.store.set(PIPELINE_SETTING_KEY, {
    id: "pipe-1",
    name,
    stages,
    syncedAt: FRESH,
  })
  return stages
}

beforeEach(() => {
  mocks.store.clear()
  mocks.staleLeads = []
  mocks.updates = []
  mocks.listPipelines.mockReset()
  mocks.isGhlConfigured.mockReset()
  mocks.isGhlConfigured.mockReturnValue(true)
  vi.spyOn(Date, "now").mockReturnValue(NOW)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("mapPipelineStages", () => {
  it("orders stages by their GHL position", () => {
    const mapped = mapPipelineStages([
      { id: "b", name: "Contacted", position: 2 },
      { id: "a", name: "New Lead" },
      { id: "w", name: "Closed Won", position: 1 },
    ])
    expect(mapped.map((item) => item.id)).toEqual(["a", "w", "b"])
  })

  it("gives closed and new stages their semantic colours", () => {
    const mapped = mapPipelineStages([
      { id: "n", name: "New Lead", position: 0 },
      { id: "w", name: "Closed Won", position: 1 },
      { id: "l", name: "Closed Lost", position: 2 },
    ])
    expect(mapped[0]!.color).toBe("#a99bd0")
    expect(mapped[1]!.color).toBe("#2f9e6e")
    expect(mapped[2]!.color).toBe("#c0364a")
  })

  it("cycles the palette for pipelines longer than the palette", () => {
    const mapped = mapPipelineStages(
      Array.from({ length: 13 }, (_, index) => ({ id: `s${index}`, name: `Stage ${index}`, position: index })),
    )
    expect(mapped).toHaveLength(13)
    expect(mapped[10]!.color).toBe(mapped[0]!.color)
    expect(mapped.every((item) => Boolean(item.bg) && Boolean(item.fg))).toBe(true)
  })
})

describe("normalizeStageName / matchStage", () => {
  it("normalizes case and punctuation", () => {
    expect(normalizeStageName("  Closed - Won!! ")).toBe("closed won")
  })

  it("matches a stage renamed in GHL by its normalized name", () => {
    const next = [stage("ghl-1", "New Lead"), stage("ghl-2", "Closed Won")]
    expect(matchStage("old-new", [stage("old-new", "New Lead")], next)?.id).toBe("ghl-1")
    expect(matchStage("old-won", [stage("old-won", "closed - won")], next)?.id).toBe("ghl-2")
  })

  it("matches the old stage id itself when there is no previous name", () => {
    expect(matchStage("Closed Won", [], [stage("ghl-won", "Closed Won")])?.id).toBe("ghl-won")
  })

  it("falls back to a contains-match for renamed variants", () => {
    const next = [stage("ghl-proposal", "Proposal")]
    expect(matchStage("old", [stage("old", "Proposal Sent")], next)?.id).toBe("ghl-proposal")
    expect(matchStage("old2", [stage("old2", "Contacted")], [stage("ghl-hot", "Contacted - Hot")])?.id).toBe(
      "ghl-hot",
    )
  })

  it("returns undefined when nothing resembles the old stage", () => {
    expect(matchStage("old", [stage("old", "Qualified")], [stage("ghl", "Closed Won")])).toBeUndefined()
    expect(matchStage("!!!", [], [stage("ghl", "New Lead")])).toBeUndefined()
  })
})

describe("getLeadPipeline", () => {
  it("fetches the configured pipeline, maps it and caches it", async () => {
    mocks.listPipelines.mockResolvedValue([
      { id: "pipe-other", name: "Other pipeline", stages: [] },
      {
        id: "pipe-dubai",
        name: "  dubai off plan sales ",
        stages: [
          { id: "st-new", name: "New Lead", position: 0 },
          { id: "st-contact", name: "Contacted", position: 1 },
        ],
      },
    ])

    const pipeline = await getLeadPipeline()
    expect(pipeline.id).toBe("pipe-dubai")
    expect(pipeline.name).toBe("  dubai off plan sales ")
    expect(pipeline.stages.map((item) => item.id)).toEqual(["st-new", "st-contact"])
    expect(pipeline.connected).toBe(true)
    expect(mocks.store.get(PIPELINE_SETTING_KEY)).toMatchObject({ id: "pipe-dubai", syncedAt: NOW })

    await getLeadPipeline()
    expect(mocks.listPipelines).toHaveBeenCalledTimes(1)
  })

  it("finds the Dubai off-plan pipeline when the exact name changed", async () => {
    mocks.listPipelines.mockResolvedValue([
      { id: "pipe-a", name: "General", stages: [{ id: "a1", name: "New" }] },
      { id: "pipe-b", name: "Dubai Off-Plan Sales 2026", stages: [{ id: "b1", name: "New" }] },
    ])

    expect((await getLeadPipeline()).id).toBe("pipe-b")
  })

  it("falls back to the first pipeline when none matches", async () => {
    mocks.listPipelines.mockResolvedValue([
      { id: "pipe-a", name: "General", stages: [{ id: "a1", name: "New" }] },
      { id: "pipe-b", name: "Luxury", stages: [{ id: "b1", name: "Enquiry" }] },
    ])

    expect((await getLeadPipeline()).id).toBe("pipe-a")
  })

  it("keeps the offline stage list when the pipeline has no stages", async () => {
    mocks.listPipelines.mockResolvedValue([{ id: "pipe-empty", name: "Dubai Off Plan Sales", stages: [] }])

    const pipeline = await getLeadPipeline()
    expect(pipeline.id).toBeNull()
    expect(pipeline.name).toBe("Website leads")
    expect(pipeline.stages).toEqual(LEAD_PIPELINE_STAGES)
    expect(mocks.store.has(PIPELINE_SETTING_KEY)).toBe(false)
  })

  it("uses the offline stage list when GHL is not configured", async () => {
    mocks.isGhlConfigured.mockReturnValue(false)

    const pipeline = await getLeadPipeline()
    expect(pipeline.connected).toBe(false)
    expect(pipeline.stages).toEqual(LEAD_PIPELINE_STAGES)
    expect(mocks.listPipelines).not.toHaveBeenCalled()
  })

  it("serves a fresh cache without calling GHL", async () => {
    cachePipeline()

    await getLeadPipeline()
    expect(mocks.listPipelines).not.toHaveBeenCalled()
  })

  it("falls back to the last good stages when GHL errors", async () => {
    const cached = cachePipeline()
    mocks.store.set(PIPELINE_SETTING_KEY, { id: "pipe-1", name: "Dubai Off Plan Sales", stages: cached, syncedAt: STALE })
    mocks.listPipelines.mockRejectedValue(new Error("GHL is down"))

    const pipeline = await getLeadPipeline()
    expect(pipeline.id).toBe("pipe-1")
    expect(pipeline.stages).toEqual(cached)
  })

  it("remaps leads left on a stage id from the previous pipeline", async () => {
    const previous = cachePipeline()
    mocks.store.set(PIPELINE_SETTING_KEY, {
      id: "pipe-1",
      name: "Dubai Off Plan Sales",
      stages: previous,
      syncedAt: STALE,
    })
    mocks.staleLeads = [
      { id: "lead-1", stage: "st-contacted" },
      { id: "lead-2", stage: "unknown-stage" },
    ]
    mocks.listPipelines.mockResolvedValue([
      {
        id: "pipe-2",
        name: "Dubai Off Plan Sales",
        stages: [
          { id: "ghl-new", name: "New Lead", position: 0 },
          { id: "ghl-contact", name: "Contacted", position: 1 },
        ],
      },
    ])

    await getLeadPipeline()

    expect(mocks.updates).toEqual([{ stage: "ghl-contact" }, { stage: "ghl-new" }])
  })
})
