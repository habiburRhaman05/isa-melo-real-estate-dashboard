import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"

import { Providers } from "@/components/providers"
import type { SessionUser } from "@/lib/auth"
import type { LeadRecord, TeamUser } from "@/lib/db/queries"
import type { LeadPipelineStage } from "@/lib/leads"

import { LeadsView } from "./leads-view"

const admin: SessionUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@test.local",
  name: "Amina Owner",
  role: "admin",
  avatarBg: "#e6dcf7",
  avatarFg: "#5a2d9c",
  avatarUrl: null,
}

const teamUser: TeamUser = {
  ...admin,
  passwordHash: "hash",
  status: "active",
  lastLoginAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
}

const stages: LeadPipelineStage[] = [
  { id: "st-new", name: "New Lead", color: "#a99bd0", bg: "#ece4fa", fg: "#6b5f8a" },
  { id: "st-contacted", name: "Contacted", color: "#5a2d9c", bg: "#ece4fa", fg: "#5a2d9c" },
  { id: "st-won", name: "Closed Won", color: "#2f9e6e", bg: "#d5eadf", fg: "#25704f" },
]

function makeLead(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    number: 1001,
    firstName: "Layla",
    lastName: "Haddad",
    phone: "+971500000001",
    email: "layla@test.local",
    business: "Skyline Realty",
    info: "Off-plan focus",
    address: "Marina Gate 2",
    country: "UAE",
    professional: "Realtor",
    value: "500000.00",
    source: "Website",
    message: "",
    stage: "st-new",
    ghlContactId: null,
    ghlOpportunityId: null,
    assigneeId: null,
    followUp: null,
    closedAt: null,
    deletedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    assignee: null,
    activities: [],
    ...overrides,
  } as unknown as LeadRecord
}

function dataTransfer() {
  const store: Record<string, string> = {}
  return {
    effectAllowed: "",
    dropEffect: "",
    setData: (type: string, value: string) => {
      store[type] = value
    },
    getData: (type: string) => store[type] ?? "",
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

let fetchMock: ReturnType<typeof vi.fn>

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderLeads(ghlConnected = false, lead = makeLead()) {
  render(
    <Providers>
      <LeadsView
        user={admin}
        initialLeads={[lead]}
        initialUsers={[teamUser]}
        initialStages={stages}
        pipelineName="Dubai Off Plan Sales"
        ghlConnected={ghlConnected}
      />
    </Providers>,
  )

  fireEvent.click(screen.getByRole("button", { name: "Pipeline" }))

  return {
    card: screen.getByText("Layla Haddad").closest("article") as HTMLElement,
    stage: (id: string) => document.querySelector(`[data-stage="${id}"] .list`) as HTMLElement,
  }
}

async function dragTo(card: HTMLElement, list: HTMLElement) {
  const transfer = dataTransfer()
  fireEvent.dragStart(card, { dataTransfer: transfer })
  fireEvent.dragOver(list, { dataTransfer: transfer })
  fireEvent.drop(list, { dataTransfer: transfer })
}

describe("leads pipeline moves", () => {
  it("shows the moved card and a spinner until GHL finishes the update", async () => {
    let confirm!: (response: Response) => void
    const pending = new Promise<Response>((resolve) => {
      confirm = resolve
    })

    fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") return pending
      return json({ leads: [makeLead({ stage: "st-contacted" })] })
    })
    vi.stubGlobal("fetch", fetchMock)

    const board = renderLeads()
    await dragTo(board.card, board.stage("st-contacted"))

    await waitFor(() =>
      expect(within(board.stage("st-contacted")).getByText("Layla Haddad")).toBeInTheDocument(),
    )
    expect(screen.getByLabelText("Moving lead")).toBeInTheDocument()

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({ stage: "st-contacted" })

    confirm(json({ lead: makeLead({ stage: "st-contacted" }) }))

    await waitFor(() => expect(screen.queryByLabelText("Moving lead")).not.toBeInTheDocument())
    expect(await screen.findByText("Moved to Contacted")).toBeInTheDocument()
  })

  it("rolls back when the API rejects the stage", async () => {
    fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") return json({ error: "Unknown pipeline stage" }, 400)
      return json({ leads: [makeLead()] })
    })
    vi.stubGlobal("fetch", fetchMock)

    const board = renderLeads()
    await dragTo(board.card, board.stage("st-contacted"))

    await waitFor(() => expect(within(board.stage("st-new")).getByText("Layla Haddad")).toBeInTheDocument())
    expect(within(board.stage("st-contacted")).queryByText("Layla Haddad")).not.toBeInTheDocument()
    expect(await screen.findByText("Unknown pipeline stage")).toBeInTheDocument()
  })

  it("does nothing when the card is dropped on its current stage", async () => {
    fetchMock = vi.fn(async () => json({ leads: [makeLead()] }))
    vi.stubGlobal("fetch", fetchMock)

    const board = renderLeads()
    await dragTo(board.card, board.stage("st-new"))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(within(board.stage("st-new")).getByText("Layla Haddad")).toBeInTheDocument()
  })

  it("shows the column value for an open stage but not a closed one", () => {
    renderLeads(false, makeLead({ value: "500000.00" }))

    const openHead = document.querySelector('[data-stage="st-new"] .col-head') as HTMLElement
    expect(within(openHead).getByText("$500,000")).toBeInTheDocument()

    const closedHead = document.querySelector('[data-stage="st-won"] .col-head') as HTMLElement
    expect(within(closedHead).queryByText("$500,000")).not.toBeInTheDocument()
  })
})

describe("leads toolbar", () => {
  it("syncs with GoHighLevel and reports the counts", async () => {
    fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") return json({ connected: true, scanned: 5, created: 2, updated: 1 })
      return json({ leads: [makeLead()] })
    })
    vi.stubGlobal("fetch", fetchMock)

    renderLeads()
    fireEvent.click(screen.getByRole("button", { name: "Sync GHL" }))

    expect(await screen.findByText("GoHighLevel: 2 new, 1 updated")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/api/leads/sync", { method: "POST" })
  })

  it("surfaces a failed sync instead of silently doing nothing", async () => {
    fetchMock = vi.fn(async () =>
      json({ error: "GoHighLevel is not connected. Set GHL_PIT_TOKEN and GHL_LOCATION_ID." }, 503),
    )
    vi.stubGlobal("fetch", fetchMock)

    renderLeads()
    fireEvent.click(screen.getByRole("button", { name: "Sync GHL" }))

    expect(
      await screen.findByText("GoHighLevel is not connected. Set GHL_PIT_TOKEN and GHL_LOCATION_ID."),
    ).toBeInTheDocument()
  })

  it("filters the list by search and clears back to everything", async () => {
    renderLeads()
    fireEvent.click(screen.getByRole("button", { name: "Table" }))

    const search = screen.getByPlaceholderText("Search name, phone, business, address")
    fireEvent.change(search, { target: { value: "zzz" } })
    expect(await screen.findByText("No leads match these filters.")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }))
    expect(await screen.findByText("Skyline Realty")).toBeInTheDocument()
  })
})
