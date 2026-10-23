import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"

import { Providers } from "@/components/providers"
import type { SessionUser } from "@/lib/auth"
import type { PlannerTask, TeamUser } from "@/lib/db/queries"

import { PlannerView } from "./planner-view"

const admin: SessionUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@test.local",
  name: "Amina Owner",
  role: "admin",
  avatarBg: "#e6dcf7",
  avatarFg: "#5a2d9c",
  avatarUrl: null,
}

const member: SessionUser = {
  ...admin,
  id: "22222222-2222-4222-8222-222222222222",
  email: "member@test.local",
  name: "Sam Team",
  role: "member",
}

const ownerUser: TeamUser = {
  ...admin,
  passwordHash: "hash",
  status: "active",
  lastLoginAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
}

const memberUser: TeamUser = { ...ownerUser, ...member }
const users: TeamUser[] = [ownerUser, memberUser]

function makeTask(overrides: Partial<PlannerTask> = {}): PlannerTask {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    number: 101,
    title: "Prepare weekly market update",
    desc: "Two slides",
    prompt: "",
    ref: "",
    link: "",
    type: "post",
    priority: "medium",
    stage: "new",
    cost: "40.00",
    due: null,
    revision: null,
    createdBy: admin.id,
    deletedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    assignees: [
      {
        taskId: "44444444-4444-4444-8444-444444444444",
        userId: member.id,
        assignedAt: new Date("2026-01-01T00:00:00Z"),
        user: memberUser,
      },
    ],
    comments: [],
    ...overrides,
  } as unknown as PlannerTask
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

function renderBoard(user: SessionUser, task = makeTask()) {
  render(
    <Providers>
      <PlannerView user={user} initialTasks={[task]} initialUsers={users} />
    </Providers>,
  )
  return {
    card: screen.getByLabelText(`Edit ${task.title}`),
    stage: (id: string) => document.querySelector(`[data-stage="${id}"] .list`) as HTMLElement,
  }
}

async function dragTo(card: HTMLElement, list: HTMLElement) {
  const transfer = dataTransfer()
  fireEvent.dragStart(card, { dataTransfer: transfer })
  fireEvent.dragOver(list, { dataTransfer: transfer })
  fireEvent.drop(list, { dataTransfer: transfer })
}

describe("kanban move feedback", () => {
  it("moves the card immediately and keeps a spinner until the server confirms", async () => {
    let confirm!: (response: Response) => void
    const pending = new Promise<Response>((resolve) => {
      confirm = resolve
    })

    fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") return pending
      return json({ tasks: [makeTask({ stage: "working" })] })
    })
    vi.stubGlobal("fetch", fetchMock)

    const board = renderBoard(admin)
    await dragTo(board.card, board.stage("working"))

    /* optimistic: visible in the new column before the PATCH resolves */
    await waitFor(() =>
      expect(within(board.stage("working")).getByText("Prepare weekly market update")).toBeInTheDocument(),
    )
    expect(screen.getByLabelText("Moving task")).toBeInTheDocument()

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({ stage: "working" })

    confirm(json({ task: makeTask({ stage: "working" }) }))

    await waitFor(() => expect(screen.queryByLabelText("Moving task")).not.toBeInTheDocument())
    expect(await screen.findByText("T-101 moved to Working")).toBeInTheDocument()
  })

  it("rolls the card back to its original column when the server rejects the move", async () => {
    fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") return json({ error: "Nope, not today" }, 403)
      return json({ tasks: [makeTask()] })
    })
    vi.stubGlobal("fetch", fetchMock)

    const board = renderBoard(admin)
    await dragTo(board.card, board.stage("working"))

    await waitFor(() =>
      expect(within(board.stage("new")).getByText("Prepare weekly market update")).toBeInTheDocument(),
    )
    expect(fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "PATCH")).toHaveLength(1)
    expect(within(board.stage("working")).queryByText("Prepare weekly market update")).not.toBeInTheDocument()
    expect(await screen.findByText("Nope, not today")).toBeInTheDocument()
    expect(screen.queryByLabelText("Moving task")).not.toBeInTheDocument()
  })

  it("does not call the API when a member drops onto an owner-only stage", async () => {
    fetchMock = vi.fn(async () => json({ tasks: [makeTask()] }))
    vi.stubGlobal("fetch", fetchMock)

    const board = renderBoard(member)
    await dragTo(board.card, board.stage("approved"))

    expect(await screen.findByText("Only the owner can move tasks to Approved")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(within(board.stage("new")).getByText("Prepare weekly market update")).toBeInTheDocument()
  })

  it("ignores a drop on the column the card already belongs to", async () => {
    fetchMock = vi.fn(async () => json({ tasks: [makeTask()] }))
    vi.stubGlobal("fetch", fetchMock)

    const board = renderBoard(admin)
    await dragTo(board.card, board.stage("new"))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(within(board.stage("new")).getByText("Prepare weekly market update")).toBeInTheDocument()
  })
})
