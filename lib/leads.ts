import type { LeadStage } from "@/lib/db/enums"
import { addDays, parseDate, ymd } from "@/lib/planner"

export type DateRange = { from: string; to: string }

export type LeadFilter = {
  country: string | "all"
  stage: LeadStage | "all"
  q: string
}

export const EMPTY_LEAD_FILTER: LeadFilter = {
  country: "all",
  stage: "all",
  q: "",
}

export type LeadPipelineStage = {
  id: string
  name: string
  color: string
  bg: string
  fg: string
}

/* Offline fallback list, used until the GoHighLevel "Dubai Off Plan Sales"
   pipeline has been fetched. Every consumer takes a stage list argument (which
   defaults to this one) so the real GHL stages can drive the board. */
export const LEAD_PIPELINE_STAGES: LeadPipelineStage[] = [
  { id: "new", name: "New Lead", color: "#a99bd0", bg: "#ece4fa", fg: "#6b5f8a" },
  { id: "contacted", name: "Contacted", color: "#5a2d9c", bg: "#ece4fa", fg: "#5a2d9c" },
  { id: "qualified", name: "Qualified", color: "#d4a02a", bg: "#fbe9c9", fg: "#8a5a0f" },
  { id: "proposal", name: "Proposal Sent", color: "#2a1458", bg: "#e4dff0", fg: "#2a1458" },
  { id: "won", name: "Won", color: "#2f9e6e", bg: "#d5eadf", fg: "#25704f" },
  { id: "lost", name: "Lost", color: "#c0364a", bg: "#fbe3e8", fg: "#b32d45" },
]

export function stageInfo(id: LeadStage, stages: LeadPipelineStage[] = LEAD_PIPELINE_STAGES) {
  return stages.find((s) => s.id === id) ?? stages[0] ?? LEAD_PIPELINE_STAGES[0]!
}

/* GHL has no per-stage closed flag, so a stage named Won/Lost/Closed counts as
   closed, as do the offline fallback ids. */
export function isClosedStage(stage: LeadStage, stages: LeadPipelineStage[] = LEAD_PIPELINE_STAGES) {
  return stage === "won" || stage === "lost" || /won|lost|closed|abandon/i.test(stageInfo(stage, stages).name)
}

export function isOpenStage(stage: LeadStage, stages: LeadPipelineStage[] = LEAD_PIPELINE_STAGES) {
  return !isClosedStage(stage, stages)
}

export const PROFESSIONAL_OPTIONS = ["Realtor", "Investor", "Developer", "Business owner", "Architect", "Other"]

/* leads use whole-dollar amounts with no cents, unlike the planner's money() */
export function leadMoney(n: string | number) {
  return "$" + Math.round(Number(n) || 0).toLocaleString("en-US")
}

export function leadName(lead: { firstName: string; lastName: string }) {
  return `${lead.firstName} ${lead.lastName}`.trim()
}

export function displayLeadId(number: number) {
  return `L-${number}`
}

/* deterministic avatar color per lead, cycling the same 4-color palette the
   prototype uses (leads aren't users, so they don't carry avatarBg/avatarFg) */
const LEAD_AVATAR_PALETTE: { bg: string; fg: string }[] = [
  { bg: "#e6dcf7", fg: "#5a2d9c" },
  { bg: "#f6eac0", fg: "#8a6212" },
  { bg: "#fbe3e8", fg: "#b32d45" },
  { bg: "#d5eadf", fg: "#25704f" },
]

export function leadAvatarColors(number: number) {
  return LEAD_AVATAR_PALETTE[number % LEAD_AVATAR_PALETTE.length]!
}

export function relDay(s: string) {
  const today = ymd(new Date())
  const n = Math.round((parseDate(today).getTime() - parseDate(s).getTime()) / 86_400_000)
  if (n <= 0) return "Today"
  if (n === 1) return "Yesterday"
  return `${n} days ago`
}

export function fmtRelativeTime(iso: string | Date) {
  const minutes = (Date.now() - new Date(iso).getTime()) / 60_000
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${Math.floor(minutes)}m ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
  return `${Math.floor(minutes / 1440)}d ago`
}

/* follow-up / closed status shown on the lead card and in the pipeline pane */
export function followUpInfo(
  lead: { stage: LeadStage; followUp: string | null; closedAt: Date | string | null },
  stages: LeadPipelineStage[] = LEAD_PIPELINE_STAGES,
) {
  if (!isOpenStage(lead.stage, stages)) {
    const closedAt = lead.closedAt ? new Date(lead.closedAt) : new Date()
    const days = Math.floor((Date.now() - closedAt.getTime()) / 86_400_000)
    return { cls: "", text: days ? `Closed ${days}d ago` : "Closed today" }
  }
  if (!lead.followUp) return { cls: "", text: "No follow-up" }
  const today = ymd(new Date())
  const diff = Math.round((parseDate(lead.followUp).getTime() - parseDate(today).getTime()) / 86_400_000)
  if (diff < 0) return { cls: "late", text: `Overdue · ${fmtShort(lead.followUp)}` }
  if (diff === 0) return { cls: "soon", text: "Follow up today" }
  if (diff === 1) return { cls: "soon", text: "Follow up tomorrow" }
  return { cls: "", text: `Follow up ${fmtShort(lead.followUp)}` }
}

function fmtShort(s: string) {
  return parseDate(s).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function daysInPipeline(createdAt: Date | string, closedAt: Date | string | null) {
  const end = closedAt ? new Date(closedAt) : new Date()
  const start = new Date(createdAt)
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000))
}

/* quick follow-up chips: Tomorrow / In 3 days / Next week */
export function followUpQuickDate(days: number) {
  return ymd(addDays(new Date(), days))
}

export type LeadLike = {
  id: string
  firstName: string
  lastName: string
  phone: string
  email: string
  business: string
  info: string
  address: string
  country: string
  professional: string
  stage: LeadStage
  value: string
  createdAt: Date | string
}

export function matchesLead(lead: LeadLike, filter: LeadFilter) {
  if (filter.country !== "all" && lead.country !== filter.country) return false
  if (filter.stage !== "all" && lead.stage !== filter.stage) return false

  if (filter.q) {
    const hay = [
      lead.firstName,
      lead.lastName,
      lead.phone,
      lead.email,
      lead.business,
      lead.info,
      lead.address,
      lead.country,
      lead.professional,
    ]
      .join(" ")
      .toLowerCase()
    if (!hay.includes(filter.q.toLowerCase())) return false
  }

  return true
}

export function filterLeads<T extends LeadLike>(leads: T[], filter: LeadFilter) {
  return leads.filter((lead) => matchesLead(lead, filter))
}

export function hasAnyLeadFilter(filter: LeadFilter) {
  return filter.country !== "all" || filter.stage !== "all" || Boolean(filter.q)
}

export function leadCountries<T extends LeadLike>(leads: T[]) {
  return Array.from(new Set(leads.map((l) => l.country).filter(Boolean))).sort()
}

export function leadStats<T extends LeadLike>(leads: T[], stages: LeadPipelineStage[] = LEAD_PIPELINE_STAGES) {
  const today = ymd(new Date())
  const newLast7 = leads.filter((l) => {
    const created = typeof l.createdAt === "string" ? l.createdAt.slice(0, 10) : ymd(new Date(l.createdAt))
    const days = Math.round((parseDate(today).getTime() - parseDate(created).getTime()) / 86_400_000)
    return days <= 7
  }).length
  const countries = new Set(leads.map((l) => l.country).filter(Boolean)).size
  const openPipelineValue = leads
    .filter((l) => isOpenStage(l.stage, stages))
    .reduce((sum, l) => sum + (Number(l.value) || 0), 0)

  return {
    total: leads.length,
    newLast7,
    countries,
    openPipelineValue,
  }
}

/* client-side CSV export, mirrors the prototype's #lExport handler exactly -
   no server round trip, built straight from whatever is currently filtered */
export function leadsToCsv<T extends LeadLike & { createdAt: Date | string }>(
  leads: T[],
  stages: LeadPipelineStage[] = LEAD_PIPELINE_STAGES,
): string {
  const headers = [
    "First name",
    "Last name",
    "Phone",
    "Email",
    "Business",
    "Business info",
    "Address",
    "Country",
    "Professional",
    "Value",
    "Stage",
    "Created",
  ]
  const rows = leads.map((l) => [
    l.firstName,
    l.lastName,
    l.phone,
    l.email,
    l.business,
    l.info,
    l.address,
    l.country,
    l.professional,
    String(Number(l.value) || 0),
    stageInfo(l.stage, stages).name,
    typeof l.createdAt === "string" ? l.createdAt.slice(0, 10) : ymd(new Date(l.createdAt)),
  ])
  return [headers, ...rows]
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n")
}
