import path from "node:path"

import { expect, test } from "@playwright/test"

import { ACCOUNTS, login } from "./utils"

/* every test creates its own uniquely-titled task and deletes it before
   finishing, so the shared seeded board never accumulates e2e junk. */
function uniqueTitle(label: string) {
  return `E2E ${label} ${Date.now()}`
}

async function createTask(page: import("@playwright/test").Page, title: string) {
  await page.getByRole("button", { name: /new task/i }).click()
  await page.waitForSelector("text=Create a task")
  await page.locator("#fTitle").fill(title)
  const [createResponse] = await Promise.all([
    page.waitForResponse((res) => res.url().endsWith("/api/tasks") && res.request().method() === "POST"),
    page.getByRole("button", { name: /create task/i }).click(),
  ])
  expect(createResponse.ok()).toBe(true)
  await page.waitForSelector("text=Create a task", { state: "detached" })
  await expect(page.locator(".card", { hasText: title })).toBeVisible()
}

async function deleteTaskByTitle(page: import("@playwright/test").Page, title: string) {
  const card = page.locator(".card", { hasText: title }).first()
  if ((await card.count()) === 0) return
  await card.click()
  await page.waitForSelector("text=Task details")
  const deleteBtn = page.locator(".m-foot .btn-del")
  const [deleteResponse] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/tasks/") && res.request().method() === "DELETE"),
    deleteBtn.click().then(() => deleteBtn.click()),
  ])
  expect(deleteResponse.ok()).toBe(true)
  await page.waitForSelector("text=Task details", { state: "detached" })
}

/* safety net: UI cleanup above can be skipped if a test fails mid-way, so
   sweep anything still tagged "E2E " off the shared board via the API once
   the whole file is done, regardless of which tests passed or failed. */
test.afterAll(async ({ request }) => {
  const loginRes = await request.post("/api/auth/login", {
    data: { email: ACCOUNTS.superAdmin.email, password: ACCOUNTS.superAdmin.password },
  })
  if (!loginRes.ok()) return

  const tasksRes = await request.get("/api/tasks")
  if (!tasksRes.ok()) return
  const { tasks } = (await tasksRes.json()) as { tasks: { id: string; title: string }[] }

  await Promise.all(
    tasks.filter((t) => t.title.startsWith("E2E ")).map((t) => request.delete(`/api/tasks/${t.id}`)),
  )
})

test.describe("planner: task lifecycle (admin)", () => {
  /* each test chains several sequential round trips (create, open, edit,
     save, reopen, delete) against a real Neon Postgres instance - comfortably
     under the default 30s only when every hop is fast. Give them room. */
  test.describe.configure({ timeout: 60_000 })

  test("creates a task and sees it appear on the board", async ({ page }) => {
    const title = uniqueTitle("create")
    await login(page, ACCOUNTS.superAdmin.email, ACCOUNTS.superAdmin.password)

    await createTask(page, title)
    await deleteTaskByTitle(page, title)
  })

  test("edits an existing task's details", async ({ page }) => {
    const title = uniqueTitle("edit")
    await login(page, ACCOUNTS.superAdmin.email, ACCOUNTS.superAdmin.password)

    await createTask(page, title)

    await page.locator(".card", { hasText: title }).click()
    await page.waitForSelector("text=Task details")
    await page.locator("#fDesc").fill("Edited by the e2e test.")
    const [updateResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/tasks/") && res.request().method() === "PATCH"),
      page.getByRole("button", { name: /save changes/i }).click(),
    ])
    expect(updateResponse.ok()).toBe(true)
    await page.waitForSelector("text=Task details", { state: "detached" })

    await expect(page.locator(".card", { hasText: title })).toContainText("Edited by the e2e test.")

    await deleteTaskByTitle(page, title)
  })

  test("adds and deletes a comment on a task", async ({ page }) => {
    const title = uniqueTitle("comment")
    await login(page, ACCOUNTS.superAdmin.email, ACCOUNTS.superAdmin.password)

    await createTask(page, title)

    await page.locator(".card", { hasText: title }).click()
    await page.waitForSelector("text=Task details")
    await page.locator("#cmtText").fill("Posted by the e2e test")
    const [commentResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/comments") && res.request().method() === "POST"),
      page.getByRole("button", { name: "Post" }).click(),
    ])
    expect(commentResponse.ok()).toBe(true)
    await expect(page.locator(".cmt", { hasText: "Posted by the e2e test" })).toBeVisible()

    const [deleteCommentResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/comments/") && res.request().method() === "DELETE"),
      page.locator(".cmt", { hasText: "Posted by the e2e test" }).locator(".del").click(),
    ])
    expect(deleteCommentResponse.ok()).toBe(true)
    await expect(page.locator(".cmt", { hasText: "Posted by the e2e test" })).toHaveCount(0)

    await page.getByRole("button", { name: "Close" }).click()
    await deleteTaskByTitle(page, title)
  })

  test("uploads a reference file on a task", async ({ page }) => {
    const title = uniqueTitle("upload")
    await login(page, ACCOUNTS.superAdmin.email, ACCOUNTS.superAdmin.password)

    await page.getByRole("button", { name: /new task/i }).click()
    await page.waitForSelector("text=Create a task")
    await page.locator("#fTitle").fill(title)

    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.setInputFiles(path.resolve(__dirname, "fixtures", "test-upload.png"))
    await expect(page.locator("#fRef")).toHaveValue(/^https?:\/\//, { timeout: 10000 })

    await page.getByRole("button", { name: /create task/i }).click()
    await page.waitForSelector("text=Create a task", { state: "detached" })
    await expect(page.locator(".card", { hasText: title })).toBeVisible()

    await deleteTaskByTitle(page, title)
  })

  /* The board also supports moving a card via the stage <select> in its modal
     (FEATURES.md lists "drag and drop / select" as equivalent paths) - this
     drives the same PATCH + canMoveToStage permission check that drag-and-drop
     uses, without fighting headless Chromium's native HTML5 DnD simulation. */
  test("moves a task to another stage via the modal's stage select", async ({ page }) => {
    const title = uniqueTitle("move")
    await login(page, ACCOUNTS.superAdmin.email, ACCOUNTS.superAdmin.password)

    await createTask(page, title)
    await expect(page.locator('.col[data-stage="new"] .card', { hasText: title })).toBeVisible()

    await page.locator(".card", { hasText: title }).click()
    await page.waitForSelector("text=Task details")
    await page.locator("#fStage").selectOption("working")
    const [moveResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/tasks/") && res.request().method() === "PATCH"),
      page.getByRole("button", { name: /save changes/i }).click(),
    ])
    expect(moveResponse.ok()).toBe(true)
    await page.waitForSelector("text=Task details", { state: "detached" })

    await expect(page.locator('.col[data-stage="working"] .card', { hasText: title })).toBeVisible()
    await expect(page.locator('.col[data-stage="new"] .card', { hasText: title })).toHaveCount(0)

    await deleteTaskByTitle(page, title)
  })
})

test.describe("planner: member permission boundaries", () => {
  test("a member does not see the new task button and cannot access Team/Admins", async ({ page }) => {
    await login(page, ACCOUNTS.memberA.email, ACCOUNTS.memberA.password)

    await expect(page.getByRole("button", { name: /new task/i })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Team" })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Admins" })).toHaveCount(0)

    await page.goto("/team")
    await page.waitForURL("**/planner")
  })

  test("approved and posted columns are locked for a member", async ({ page }) => {
    await login(page, ACCOUNTS.memberA.email, ACCOUNTS.memberA.password)

    await expect(page.locator('.col.locked[data-stage="approved"]')).toBeVisible()
    await expect(page.locator('.col.locked[data-stage="posted"]')).toBeVisible()
    await expect(page.locator('.col[data-stage="working"]')).not.toHaveClass(/locked/)
  })
})
