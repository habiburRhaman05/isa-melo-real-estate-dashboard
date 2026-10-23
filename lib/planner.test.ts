import {
  addDays,
  diffDays,
  displayId,
  dueInfo,
  EMPTY_FILTER,
  filterTasks,
  hasAnyFilter,
  linkLabel,
  matchesTask,
  money,
  parseDate,
  plannerStats,
  presetRange,
  type TaskLike,
  typeName,
  ymd,
} from "./planner"

function task(overrides: Partial<TaskLike> = {}): TaskLike {
  return {
    id: "t1",
    number: 101,
    title: "Prepare weekly update",
    desc: "desc",
    prompt: "",
    ref: "",
    link: "",
    type: "post",
    priority: "medium",
    stage: "new",
    cost: "40",
    due: null,
    revision: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    assignees: [],
    comments: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-03-10T12:00:00Z"))
})

afterEach(() => {
  vi.useRealTimers()
})

describe("date helpers", () => {
  it("ymd/parseDate round-trip", () => {
    const d = new Date(2026, 2, 15) // March 15, 2026 (local)
    expect(ymd(d)).toBe("2026-03-15")
    expect(ymd(parseDate("2026-03-15"))).toBe("2026-03-15")
  })

  it("addDays moves forward and backward", () => {
    expect(ymd(addDays(parseDate("2026-03-10"), 5))).toBe("2026-03-15")
    expect(ymd(addDays(parseDate("2026-03-10"), -5))).toBe("2026-03-05")
  })

  it("diffDays returns a signed day count", () => {
    expect(diffDays("2026-03-15", "2026-03-10")).toBe(5)
    expect(diffDays("2026-03-05", "2026-03-10")).toBe(-5)
    expect(diffDays("2026-03-10", "2026-03-10")).toBe(0)
  })
})

describe("money", () => {
  it("formats numbers and numeric strings as USD", () => {
    expect(money(40)).toBe("$40.00")
    expect(money("40")).toBe("$40.00")
    expect(money("40.5")).toBe("$40.50")
  })

  it("treats falsy/empty input as zero", () => {
    expect(money("")).toBe("$0.00")
    expect(money(0)).toBe("$0.00")
  })
})

describe("displayId / typeName / linkLabel", () => {
  it("displayId prefixes with T-", () => {
    expect(displayId(101)).toBe("T-101")
  })

  it("typeName resolves known types and falls back to the raw id", () => {
    expect(typeName("reel")).toBe("Reel")
  })

  it("linkLabel strips the scheme and www, keeps a meaningful path", () => {
    expect(linkLabel("https://www.figma.com/file/abc")).toBe("figma.com/file/abc")
    expect(linkLabel("https://drive.google.com/")).toBe("drive.google.com")
  })

  it("linkLabel returns the raw string when it isn't a valid URL", () => {
    expect(linkLabel("not a url")).toBe("not a url")
  })
})

describe("dueInfo", () => {
  it("reports 'Not set' when there is no due date", () => {
    expect(dueInfo(null, "new")).toEqual({ cls: "", text: "Not set" })
  })

  it("flags a past-due date as late, unless the task is already done", () => {
    const late = dueInfo("2026-03-05", "working") // 5 days before the fake 'today'
    expect(late.cls).toBe("late")

    const doneButPastDue = dueInfo("2026-03-05", "posted")
    expect(doneButPastDue.cls).toBe("")
  })

  it("flags a due date within 2 days as soon", () => {
    expect(dueInfo("2026-03-11", "working").cls).toBe("soon")
    expect(dueInfo("2026-03-12", "working").cls).toBe("soon")
  })

  it("does not flag a due date further than 2 days out", () => {
    expect(dueInfo("2026-03-20", "working").cls).toBe("")
  })
})

describe("matchesTask / filterTasks", () => {
  it("matches everything when the filter is empty", () => {
    expect(matchesTask(task(), EMPTY_FILTER)).toBe(true)
  })

  it("filters by priority", () => {
    const t = task({ priority: "high" })
    expect(matchesTask(t, { ...EMPTY_FILTER, priority: "high" })).toBe(true)
    expect(matchesTask(t, { ...EMPTY_FILTER, priority: "low" })).toBe(false)
  })

  it("filters by task type", () => {
    const t = task({ type: "reel" })
    expect(matchesTask(t, { ...EMPTY_FILTER, type: "reel" })).toBe(true)
    expect(matchesTask(t, { ...EMPTY_FILTER, type: "video" })).toBe(false)
  })

  it("filters by due date range, excluding tasks with no due date once a range is set", () => {
    const withDue = task({ due: "2026-03-15" })
    const withoutDue = task({ due: null })
    const filter = { ...EMPTY_FILTER, due: { from: "2026-03-10", to: "2026-03-20" } }
    expect(matchesTask(withDue, filter)).toBe(true)
    expect(matchesTask(withoutDue, filter)).toBe(false)
    expect(matchesTask(task({ due: "2026-04-01" }), filter)).toBe(false)
  })

  it("matches free-text search across title, desc, ref, link, comments and assignee names", () => {
    const t = task({
      title: "Open house flyer",
      assignees: [{ user: { id: "u1", name: "Rakib" } }],
      comments: [{ text: "please double check pricing" }],
    })
    expect(matchesTask(t, { ...EMPTY_FILTER, q: "flyer" })).toBe(true)
    expect(matchesTask(t, { ...EMPTY_FILTER, q: "rakib" })).toBe(true)
    expect(matchesTask(t, { ...EMPTY_FILTER, q: "pricing" })).toBe(true)
    expect(matchesTask(t, { ...EMPTY_FILTER, q: "nonexistent" })).toBe(false)
  })

  it("filterTasks returns only the tasks that match", () => {
    const tasks = [task({ id: "a", priority: "high" }), task({ id: "b", priority: "low" })]
    const filtered = filterTasks(tasks, { ...EMPTY_FILTER, priority: "high" })
    expect(filtered.map((t) => t.id)).toEqual(["a"])
  })
})

describe("hasAnyFilter", () => {
  it("is false for the empty filter and true once anything is set", () => {
    expect(hasAnyFilter(EMPTY_FILTER)).toBe(false)
    expect(hasAnyFilter({ ...EMPTY_FILTER, priority: "high" })).toBe(true)
    expect(hasAnyFilter({ ...EMPTY_FILTER, q: "x" })).toBe(true)
  })
})

describe("plannerStats", () => {
  it("counts active tasks, sums cost excluding posted, and counts review/soon", () => {
    const tasks = [
      task({ id: "a", stage: "new", cost: "40", due: "2026-03-11" }), // soon
      task({ id: "b", stage: "review", cost: "20" }),
      task({ id: "c", stage: "posted", cost: "999" }), // excluded from active + cost
    ]
    const stats = plannerStats(tasks, "member")
    expect(stats.active).toBe(2)
    expect(stats.total).toBe(60)
    expect(stats.review).toBe(1)
    expect(stats.soon).toBe(1)
    expect(stats.reviewLabel).toBe("Sent for owner review")
  })

  it("uses the owner-facing review label for admin/super_admin", () => {
    expect(plannerStats([], "admin").reviewLabel).toBe("Waiting for your review")
  })
})

describe("presetRange", () => {
  it("'today' returns the same from/to", () => {
    const r = presetRange("today")
    expect(r.from).toBe(r.to)
    expect(r.from).toBe("2026-03-10")
  })

  it("'next7' spans today to 7 days later", () => {
    const r = presetRange("next7")
    expect(r.from).toBe("2026-03-10")
    expect(r.to).toBe("2026-03-17")
  })

  it("'last7' spans 7 days ago to today", () => {
    const r = presetRange("last7")
    expect(r.from).toBe("2026-03-03")
    expect(r.to).toBe("2026-03-10")
  })

  it("'month' spans the first to the last day of the current month", () => {
    const r = presetRange("month")
    expect(r.from).toBe("2026-03-01")
    expect(r.to).toBe("2026-03-31")
  })
})
