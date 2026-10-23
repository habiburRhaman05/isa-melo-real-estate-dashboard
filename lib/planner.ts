import type { Priority, TaskStage, TaskType } from "@/lib/db/enums"

export type DateRange = { from: string; to: string }

export type PlannerFilter = {
  priority: Priority | "all"
  type: TaskType | "all"
  due: DateRange
  created: DateRange
  q: string
}

export const EMPTY_FILTER: PlannerFilter = {
  priority: "all",
  type: "all",
  due: { from: "", to: "" },
  created: { from: "", to: "" },
  q: "",
}

export const STAGES: { id: TaskStage; name: string; color: string; badge?: string }[] = [
  { id: "new", name: "New Task", color: "#a99bd0" },
  { id: "working", name: "Working", color: "#5a2d9c" },
  { id: "review", name: "Need Review", color: "#7a5a00", badge: "FOR YOU" },
  { id: "revision", name: "Revision", color: "#c0364a", badge: "FOR TEAM" },
  { id: "approved", name: "Approved", color: "#d4a02a" },
  { id: "posted", name: "Posted", color: "#2f9e6e" },
]

export const TYPES: { id: TaskType; name: string }[] = [
  { id: "post", name: "Post" },
  { id: "reel", name: "Reel" },
  { id: "video", name: "Video" },
  { id: "image", name: "Image" },
]

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
}

export type TaskLike = {
  id: string
  number: number
  title: string
  desc: string
  prompt: string
  ref: string
  link: string
  type: TaskType
  priority: Priority
  stage: TaskStage
  cost: string
  due: string | null
  revision: string | null
  createdAt: Date | string
  assignees: { user: { id: string; name: string } | null }[]
  comments: { text: string }[]
}

/* ---------- dates ---------- */

const pad = (n: number) => String(n).padStart(2, "0")

export function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDate(s: string) {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1)
}

export function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function fmtDate(s: string) {
  return parseDate(s).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function fmtDateY(s: string) {
  return parseDate(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function fmtTime(iso: string | Date) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function diffDays(a: string, b: string) {
  return Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / 86_400_000)
}

export function money(n: string | number) {
  return Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD" })
}

/* ---------- display helpers ---------- */

export function displayId(number: number) {
  return `T-${number}`
}

export function typeName(type: TaskType) {
  return TYPES.find((t) => t.id === type)?.name ?? type
}

export function linkLabel(url: string) {
  try {
    const u = new URL(url)
    const path = u.pathname.length > 1 ? u.pathname : ""
    return u.hostname.replace(/^www\./, "") + path
  } catch {
    return url
  }
}

export function dueInfo(due: string | null, stage: TaskStage) {
  if (!due) return { cls: "", text: "Not set" }
  const done = stage === "approved" || stage === "posted"
  const d = diffDays(due, ymd(new Date()))
  let cls = ""
  if (!done) {
    if (d < 0) cls = "late"
    else if (d <= 2) cls = "soon"
  }
  return { cls, text: fmtDate(due) }
}

/* ---------- filtering (mirrors the prototype) ---------- */

function inRange(val: string | null | undefined, r: DateRange) {
  if (!r.from) return true
  if (!val) return false
  return val >= r.from && val <= (r.to || r.from)
}

export function matchesTask(task: TaskLike, filter: PlannerFilter) {
  if (filter.priority !== "all" && task.priority !== filter.priority) return false
  if (filter.type !== "all" && task.type !== filter.type) return false
  if (!inRange(task.due, filter.due)) return false

  const created = typeof task.createdAt === "string" ? task.createdAt.slice(0, 10) : ymd(task.createdAt)
  if (!inRange(created, filter.created)) return false

  if (filter.q) {
    const names = task.assignees.map((a) => a.user?.name ?? "").join(" ")
    const hay = [
      displayId(task.number),
      typeName(task.type),
      task.revision ?? "",
      task.comments.map((c) => c.text).join(" "),
      task.title,
      task.desc,
      task.prompt,
      task.ref,
      task.link,
      names,
    ]
      .join(" ")
      .toLowerCase()
    if (!hay.includes(filter.q.toLowerCase())) return false
  }

  return true
}

export function filterTasks<T extends TaskLike>(tasks: T[], filter: PlannerFilter) {
  return tasks.filter((task) => matchesTask(task, filter))
}

export function hasAnyFilter(filter: PlannerFilter) {
  return (
    filter.priority !== "all" ||
    filter.type !== "all" ||
    Boolean(filter.due.from) ||
    Boolean(filter.created.from) ||
    Boolean(filter.q)
  )
}

/* ---------- stats (mirrors the prototype) ---------- */

export function plannerStats(tasks: TaskLike[], role: "member" | "admin" | "super_admin") {
  const active = tasks.filter((t) => t.stage !== "posted")
  const total = active.reduce((sum, t) => sum + (Number(t.cost) || 0), 0)
  const review = tasks.filter((t) => t.stage === "review").length
  const today = ymd(new Date())
  const soonEnd = ymd(addDays(new Date(), 7))
  const soon = active.filter((t) => t.due && t.due >= today && t.due <= soonEnd).length
  const reviewLabel = role === "member" ? "Sent for owner review" : "Waiting for your review"

  return {
    active: active.length,
    total,
    review,
    soon,
    reviewLabel,
  }
}

/* ---------- calendar range ---------- */

export type PresetRange =
  | { from: string; to: string; label: string; month: Date }
  | { from: string; to: string }

export function presetRange(name: string): { from: string; to: string } {
  const now = new Date()
  switch (name) {
    case "today":
      return { from: ymd(now), to: ymd(now) }
    case "next7":
      return { from: ymd(now), to: ymd(addDays(now, 7)) }
    case "last7":
      return { from: ymd(addDays(now, -7)), to: ymd(now) }
    case "month":
      return {
        from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      }
    default:
      return {
        from: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 1)),
        to: ymd(new Date(now.getFullYear(), now.getMonth() + 2, 0)),
      }
  }
}
