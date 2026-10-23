"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence } from "framer-motion"
import { Download, LayoutGrid, Loader2, Plus, RefreshCw, Search, Table2 } from "lucide-react"
import { useEffect, useState } from "react"

import { useToast } from "@/components/toast"
import type { SessionUser } from "@/lib/auth"
import type { LeadStage } from "@/lib/db/enums"
import type { LeadRecord, TeamUser } from "@/lib/db/queries"
import {
  EMPTY_LEAD_FILTER,
  filterLeads,
  hasAnyLeadFilter,
  leadCountries,
  type LeadFilter,
  type LeadPipelineStage,
  leadStats,
  leadsToCsv,
  stageInfo,
} from "@/lib/leads"
import { canManageLeads } from "@/lib/permissions"

import { AddLeadModal } from "./add-lead-modal"
import { LeadModal } from "./lead-modal"
import { LeadsPipeline } from "./leads-pipeline"
import { LeadsTable } from "./leads-table"

async function fetchLeads(): Promise<LeadRecord[]> {
  const res = await fetch("/api/leads")
  if (!res.ok) throw new Error("Failed to load leads")
  const data = (await res.json()) as { leads: LeadRecord[] }
  return data.leads
}

async function fetchUsers(): Promise<TeamUser[]> {
  const res = await fetch("/api/users")
  if (!res.ok) throw new Error("Failed to load team")
  const data = (await res.json()) as { users: TeamUser[] }
  return data.users
}

function downloadCsv(csv: string) {
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "website-leads.csv"
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const today = () => new Date().toISOString().slice(0, 10)

export function LeadsView({
  user,
  initialLeads,
  initialUsers,
  initialStages,
  pipelineName,
  ghlConnected,
}: {
  user: SessionUser
  initialLeads: LeadRecord[]
  initialUsers: TeamUser[]
  initialStages: LeadPipelineStage[]
  pipelineName: string
  ghlConnected: boolean
}) {
  const stages = initialStages
  const toast = useToast()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<LeadFilter>(EMPTY_LEAD_FILTER)
  const [mode, setMode] = useState<"table" | "pipe">("table")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const canManage = canManageLeads(user)

  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: fetchLeads,
    initialData: initialLeads,
  })

  const { data: teamUsers = initialUsers } = useQuery({
    queryKey: ["leads", "users"],
    queryFn: fetchUsers,
    initialData: initialUsers,
  })

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/leads/sync", { method: "POST" })
      const data = (await res.json().catch(() => null)) as {
        error?: string
        created?: number
        updated?: number
      } | null
      if (!res.ok) throw new Error(data?.error ?? "Failed to sync with GoHighLevel")
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["leads"] })
      toast(`GoHighLevel: ${data?.created ?? 0} new, ${data?.updated ?? 0} updated`)
    },
    onError: (error: Error) => toast(error.message),
  })

  /* Pull once per browser session on open, so contacts added in GHL show up
     here without pressing anything. The button below forces a fresh pull. */
  const syncLeads = syncMutation.mutate
  useEffect(() => {
    if (!ghlConnected) return
    const key = "ghl:leads:last-sync"
    const last = Number(window.sessionStorage.getItem(key) ?? 0)
    if (Date.now() - last < 60_000) return
    window.sessionStorage.setItem(key, String(Date.now()))
    syncLeads()
  }, [ghlConnected, syncLeads])

  const moveMutation = useMutation({
    mutationFn: async ({ leadId, stage }: { leadId: string; stage: LeadStage }) => {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string; lead?: LeadRecord } | null
      if (!res.ok) throw new Error(data?.error ?? "Failed to move lead")
      return data?.lead
    },
    /* Lead writes also round-trip to GHL, so move the card right away and roll
       back if either side rejects the change. */
    onMutate: async ({ leadId, stage }) => {
      await queryClient.cancelQueries({ queryKey: ["leads"] })
      const previous = queryClient.getQueryData<LeadRecord[]>(["leads"])
      queryClient.setQueryData<LeadRecord[]>(["leads"], (current) =>
        current?.map((lead) => (lead.id === leadId ? { ...lead, stage } : lead)) ?? current,
      )
      return { previous }
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(["leads"], context.previous)
      toast(error.message)
    },
    onSuccess: (lead, variables) => {
      if (lead) toast(`Moved to ${stageInfo(variables.stage, stages).name}`)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["leads"] })
    },
  })

  const visible = filterLeads(leads, filter)
  const movingId = moveMutation.isPending ? (moveMutation.variables?.leadId ?? null) : null
  const selected = leads.find((lead) => lead.id === selectedId) ?? null
  const stats = leadStats(leads, stages)
  const countries = leadCountries(leads)
  const followUpsDue = leads.filter(
    (lead) => lead.followUp && lead.followUp <= today() && lead.stage !== "won" && lead.stage !== "lost",
  ).length

  function onMove(leadId: string, stage: LeadStage) {
    const lead = leads.find((l) => l.id === leadId)
    if (!lead || lead.stage === stage) return
    moveMutation.mutate({ leadId, stage })
  }

  function onExport() {
    const csv = leadsToCsv(visible, stages)
    downloadCsv(csv)
    toast(`Exported ${visible.length} lead${visible.length === 1 ? "" : "s"}`)
  }

  const statTiles = [
    { value: String(stats.total), label: "Total leads" },
    { value: String(stats.newLast7), label: "New in the last 7 days" },
    { value: String(stats.countries), label: "Countries reached" },
    { value: String(followUpsDue), label: "Follow-ups due" },
    { value: `$${Math.round(stats.openPipelineValue).toLocaleString("en-US")}`, label: "Open pipeline value" },
  ]

  return (
    <main className="px-6 py-9 pb-12">
      <div className="head">
        <div>
          <div className="eyebrow">
            Website leads{ghlConnected ? ` · ${pipelineName}` : ""}
          </div>
          <h1>Leads inbox</h1>
          <p className="text-muted-foreground">
            Every website enquiry in one list, tracked from first contact to closed.
          </p>
        </div>
        <div className="head-right">
          <button
            type="button"
            className="btn-ghost ex"
            disabled={syncMutation.isPending}
            title={ghlConnected ? "Pull contacts and pipeline stages from GoHighLevel" : "Add GHL_PIT_TOKEN and GHL_LOCATION_ID to connect"}
            onClick={() => syncMutation.mutate()}
          >
            {syncMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {syncMutation.isPending ? "Syncing" : "Refresh"}
          </button>
          <button type="button" className="btn-ghost ex" onClick={onExport}>
            <Download size={16} />
            Export CSV
          </button>
          {canManage ? (
            <button type="button" className="btn-brand" onClick={() => setCreating(true)}>
              <Plus size={16} strokeWidth={2.4} />
              Add lead
            </button>
          ) : null}
        </div>
      </div>

      <section className="stats lead-stats">
        {statTiles.map((item) => (
          <div key={item.label} className="stat">
            <b>{item.value}</b>
            <span>{item.label}</span>
          </div>
        ))}
      </section>

      <div className="toolbar">
        <div className="pills">
          <label className="search" style={{ minWidth: 230 }}>
            <Search size={16} />
            <input
              type="search"
              placeholder="Search name, phone, business, address"
              autoComplete="off"
              value={filter.q}
              onChange={(event) => setFilter({ ...filter, q: event.target.value })}
            />
          </label>
          <div className="vt">
            <button type="button" className={mode === "table" ? "on" : ""} onClick={() => setMode("table")}>
              <Table2 size={15} />
              Table
            </button>
            <button type="button" className={mode === "pipe" ? "on" : ""} onClick={() => setMode("pipe")}>
              <LayoutGrid size={15} />
              Pipeline
            </button>
          </div>
          {hasAnyLeadFilter(filter) ? (
            <button type="button" className="link-btn" onClick={() => setFilter(EMPTY_LEAD_FILTER)}>
              Clear filters
            </button>
          ) : null}
        </div>
        <div className="filters">
          <span className="clab">COUNTRY</span>
          <select
            className={`f-select ${filter.country !== "all" ? "active" : ""}`}
            aria-label="Filter by country"
            value={filter.country}
            onChange={(event) => setFilter({ ...filter, country: event.target.value })}
          >
            <option value="all">All countries</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
          {mode === "table" ? (
            <select
              className={`f-select ${filter.stage !== "all" ? "active" : ""}`}
              aria-label="Filter by stage"
              value={filter.stage}
              onChange={(event) => setFilter({ ...filter, stage: event.target.value as LeadFilter["stage"] })}
            >
              <option value="all">All stages</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {mode === "table" ? (
        <LeadsTable leads={visible} stages={stages} onOpen={setSelectedId} />
      ) : (
        <LeadsPipeline
          leads={visible}
          stages={stages}
          canDrag={canManage}
          movingId={movingId}
          onOpen={setSelectedId}
          onMove={onMove}
        />
      )}

      <AnimatePresence>
        {creating ? (
          <AddLeadModal onClose={() => setCreating(false)} />
        ) : selected ? (
          <LeadModal
            key={selected.id}
            lead={selected}
            users={teamUsers}
            stages={stages}
            currentUser={user}
            onClose={() => setSelectedId(null)}
          />
        ) : null}
      </AnimatePresence>
    </main>
  )
}
