import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { Providers } from "@/components/providers"
import type { SessionUser } from "@/lib/auth"
import type { PlannerTask, TeamUser } from "@/lib/db/queries"

import { TaskModal } from "./task-modal"

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

const otherMember: SessionUser = {
  ...member,
  id: "33333333-3333-4333-8333-333333333333",
  email: "other@test.local",
  name: "Other Member",
}

function teamUser(user: SessionUser): TeamUser {
  return {
    ...user,
    passwordHash: "hash",
    status: "active",
    lastLoginAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  }
}

function makeTask(overrides: Partial<PlannerTask> = {}): PlannerTask {
  const base = {
    id: "44444444-4444-4444-8444-444444444444",
    number: 101,
    title: "Prepare weekly market update",
    desc: "Two slides",
    prompt: "Use the brand voice",
    ref: "",
    link: "https://drive.google.com/file/abc",
    type: "post" as const,
    priority: "high" as const,
    stage: "working" as const,
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
        user: teamUser(member),
      },
    ],
    comments: [],
    ...overrides,
  }
  return base as unknown as PlannerTask
}

let fetchMock: ReturnType<typeof vi.fn>

function mockFetch(body: unknown = { task: makeTask() }) {
  fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }))
  vi.stubGlobal("fetch", fetchMock)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderModal(task: PlannerTask | null, currentUser: SessionUser, onClose = vi.fn()) {
  const utils = render(
    <Providers>
      <TaskModal task={task} users={[teamUser(member), teamUser(otherMember)]} currentUser={currentUser} onClose={onClose} />
    </Providers>,
  )
  return { ...utils, onClose }
}

function submissionInput() {
  return screen.getByLabelText(/Task submission/) as HTMLInputElement
}

describe("task submission link", () => {
  it("lets an admin read and open the link but not edit or upload it", async () => {
    mockFetch()
    renderModal(makeTask(), admin)

    const input = submissionInput()
    expect(input).toHaveAttribute("readonly")
    expect(input.value).toBe("https://drive.google.com/file/abc")

    const link = screen.getByRole("link", { name: "Open submission" })
    expect(link).toHaveAttribute("href", "https://drive.google.com/file/abc")
    expect(link).toHaveAttribute("target", "_blank")

    expect(screen.queryByRole("button", { name: /Upload submission/ })).not.toBeInTheDocument()
    /* the reference upload stays available: only the team link is protected */
    expect(screen.getByRole("button", { name: /Upload reference/ })).toBeInTheDocument()
  })

  it("does not send a link when an admin saves, so it can never overwrite the team's value", async () => {
    mockFetch()
    const { container, onClose } = renderModal(makeTask(), admin)

    fireEvent.change(screen.getByLabelText("Task title"), { target: { value: "Edited by the owner" } })
    fireEvent.submit(container.querySelector("form")!)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onClose).toHaveBeenCalled())

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const payload = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(url).toBe(`/api/tasks/${makeTask().id}`)
    expect(payload).toMatchObject({ title: "Edited by the owner", stage: "working", revision: null })
    expect(payload).not.toHaveProperty("link")
  })

  it("does not let an admin set a link at creation time either", async () => {
    mockFetch({ task: makeTask() })
    const { container } = renderModal(null, admin)

    expect(submissionInput()).toHaveAttribute("readonly")
    expect(screen.queryByRole("button", { name: /Upload submission/ })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Task title"), { target: { value: "Brand new task" } })
    fireEvent.submit(container.querySelector("form")!)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).not.toHaveProperty("link")
  })

  it("lets the assigned team member edit and upload the submission link", async () => {
    mockFetch()
    const { container, onClose } = renderModal(makeTask(), member)

    const input = submissionInput()
    expect(input).not.toHaveAttribute("readonly")
    expect(screen.getByRole("button", { name: /Upload submission/ })).toBeInTheDocument()

    fireEvent.change(input, { target: { value: "https://frame.io/review/xyz" } })
    fireEvent.submit(container.querySelector("form")!)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onClose).toHaveBeenCalled())

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const payload = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(payload.link).toBe("https://frame.io/review/xyz")
    /* members can't touch owner-only fields even though they can save the link */
    expect(payload).not.toHaveProperty("revision")
    expect(payload).not.toHaveProperty("assigneeIds")
  })

  it("makes the whole modal read-only for a member who isn't assigned", () => {
    mockFetch()
    renderModal(makeTask(), otherMember)

    expect(screen.getByLabelText("Task title")).toHaveAttribute("readonly")
    expect(submissionInput()).toHaveAttribute("readonly")
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Upload submission/ })).not.toBeInTheDocument()
  })

  it("shows the server's 403 instead of pretending the save worked", async () => {
    fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "The submission link is set by the team, not by an admin" }), {
          status: 403,
        }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { container, onClose } = renderModal(makeTask(), admin)
    fireEvent.submit(container.querySelector("form")!)

    await waitFor(() =>
      expect(screen.getByText("The submission link is set by the team, not by an admin")).toBeInTheDocument(),
    )
    expect(onClose).not.toHaveBeenCalled()
  })
})
