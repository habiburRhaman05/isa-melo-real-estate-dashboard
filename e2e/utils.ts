import type { Page } from "@playwright/test"

/* seeded accounts from scripts/seed.ts - safe to drive e2e tests against,
   every test that mutates data cleans up what it created. */
export const ACCOUNTS = {
  superAdmin: { email: "superadmin@isamelo.com", password: "IsaMelo@2026", name: "Isa Melo" },
  admin: { email: "admin@isamelo.com", password: "Admin@2026", name: "Ayesha Siddiqui" },
  memberA: { email: "rakib@isamelo.com", password: "Team@2026", name: "Rakib" },
  memberB: { email: "sajib@isamelo.com", password: "Team@2026", name: "Sajib" },
} as const

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: /sign in/i }).click()
  /* generous timeout: a cold dev-server route (first hit of the run) can take
     well past Next's usual response time to compile on demand. */
  await page.waitForURL("**/planner", { timeout: 30_000 })
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Account menu" }).click()
  await page.getByRole("menuitem", { name: /sign out/i }).click()
  await page.waitForURL("**/login", { timeout: 15000 })
}
