import { expect, test } from "@playwright/test"

import { ACCOUNTS, login } from "./utils"

test("redirects an unauthenticated visitor to the login page", async ({ page }) => {
  await page.goto("./")

  await page.waitForURL("**/login")
  await expect(page).toHaveTitle(/Sign in/)
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
})

test("shows the content pipeline heading after logging in", async ({ page }) => {
  await login(page, ACCOUNTS.superAdmin.email, ACCOUNTS.superAdmin.password)

  await expect(page).toHaveTitle(/Social Planner/, { timeout: 15_000 })
  await expect(page.getByRole("heading", { name: "Content pipeline" })).toBeVisible({ timeout: 15_000 })
})

test("health endpoint responds", async ({ request }) => {
  const response = await request.get("/api/health")

  expect(response.ok()).toBeTruthy()
  await expect(response.json()).resolves.toEqual({ status: "ok" })
})
