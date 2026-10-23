vi.mock("@/env.mjs", () => ({
  env: { GHL_WEBHOOK_SECRET: "hook-secret" },
}))

const mocks = vi.hoisted(() => ({ handleGhlWebhook: vi.fn() }))

vi.mock("@/lib/ghl-sync", () => ({
  handleGhlWebhook: mocks.handleGhlWebhook,
}))

import { POST } from "./route"

function request(body: unknown, query = "") {
  return new Request(`http://localhost/api/ghl/webhook${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mocks.handleGhlWebhook.mockReset()
  mocks.handleGhlWebhook.mockResolvedValue({ connected: true, scanned: 1, created: 1, updated: 0 })
})

describe("POST /api/ghl/webhook", () => {
  it("rejects a missing or wrong secret without processing the payload", async () => {
    expect((await POST(request({ contactId: "c1" }))).status).toBe(401)
    expect((await POST(request({ contactId: "c1" }, "?secret=nope"))).status).toBe(401)
    expect((await POST(request({ contactId: "c1" }, "?secret=hook-secret-2"))).status).toBe(401)
    expect(mocks.handleGhlWebhook).not.toHaveBeenCalled()
  })

  it("accepts the secret from the query string or the header", async () => {
    const viaQuery = await POST(request({ contactId: "c1" }, "?secret=hook-secret"))
    expect(viaQuery.status).toBe(200)
    await expect(viaQuery.json()).resolves.toMatchObject({ ok: true, result: { created: 1 } })

    const viaHeader = await POST(
      new Request("http://localhost/api/ghl/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ghl-webhook-secret": "hook-secret" },
        body: JSON.stringify({ contactId: "c2" }),
      }),
    )
    expect(viaHeader.status).toBe(200)
    expect(mocks.handleGhlWebhook).toHaveBeenCalledTimes(2)
    expect(mocks.handleGhlWebhook).toHaveBeenLastCalledWith({ contactId: "c2" })
  })

  it("acknowledges malformed JSON instead of letting GHL retry", async () => {
    const res = await POST(
      new Request("http://localhost/api/ghl/webhook?secret=hook-secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      }),
    )

    expect(res.status).toBe(200)
    expect(mocks.handleGhlWebhook).toHaveBeenCalledWith(null)
  })

  it("acknowledges payloads it cannot map", async () => {
    mocks.handleGhlWebhook.mockResolvedValue(null)

    const res = await POST(request({ type: "OpportunityUpdate" }, "?secret=hook-secret"))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true, result: null })
  })

  it("acknowledges even when processing throws", async () => {
    mocks.handleGhlWebhook.mockRejectedValue(new Error("sync exploded"))

    const res = await POST(request({ contactId: "c3" }, "?secret=hook-secret"))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: false })
  })
})
