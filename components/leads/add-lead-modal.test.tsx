import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { Providers } from "@/components/providers"

import { AddLeadModal } from "./add-lead-modal"

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

let fetchMock: ReturnType<typeof vi.fn>

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderModal(onClose = vi.fn()) {
  const utils = render(
    <Providers>
      <AddLeadModal onClose={onClose} />
    </Providers>,
  )
  return { ...utils, onClose, form: utils.container.querySelector("form") as HTMLFormElement }
}

describe("AddLeadModal", () => {
  it("requires a first name and never reaches the API without one", () => {
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { form } = renderModal()
    fireEvent.submit(form)

    expect(screen.getByRole("alert")).toHaveTextContent("First name is required")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("posts the draft and closes on success", async () => {
    fetchMock = vi.fn(async () => json({ lead: { number: 1002 }, sync: { skipped: true } }, 201))
    vi.stubGlobal("fetch", fetchMock)

    const { form, onClose } = renderModal()
    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "Layla" } })
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Haddad" } })
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "+971500000001" } })
    fireEvent.change(screen.getByLabelText(/Opportunity value/), { target: { value: "500000" } })
    fireEvent.submit(form)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("/api/leads")
    expect(init.method).toBe("POST")
    expect(JSON.parse(String(init.body))).toMatchObject({
      firstName: "Layla",
      lastName: "Haddad",
      phone: "+971500000001",
      value: 500000,
    })

    expect(await screen.findByText("L-1002 added")).toBeInTheDocument()
    expect(onClose).toHaveBeenCalled()
  })

  it("shows a server validation error and stays open", async () => {
    fetchMock = vi.fn(async () => json({ error: "First name is required" }, 400))
    vi.stubGlobal("fetch", fetchMock)

    const { form, onClose } = renderModal()
    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "Layla" } })
    fireEvent.submit(form)

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("First name is required"),
    )
    expect(onClose).not.toHaveBeenCalled()
  })

  it("warns when the lead saved locally but the GHL push failed", async () => {
    fetchMock = vi.fn(async () =>
      json({ lead: { number: 1003 }, sync: { skipped: false, error: "GHL is down" } }, 201),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { form, onClose } = renderModal()
    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "Omar" } })
    fireEvent.submit(form)

    expect(await screen.findByText("GoHighLevel sync failed: GHL is down")).toBeInTheDocument()
    expect(onClose).toHaveBeenCalled()
  })

  it("closes on Escape", () => {
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { onClose } = renderModal()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalled()
  })
})
