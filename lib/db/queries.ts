import { and, asc, count, desc, eq, isNull, ne, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { comments, leadActivities, leads, settings, taskAssignees, tasks, users } from "@/lib/db/schema"

export async function getPlannerTasks() {
  return db.query.tasks.findMany({
    where: isNull(tasks.deletedAt),
    with: {
      assignees: { with: { user: true } },
      comments: { orderBy: [asc(comments.createdAt)] },
    },
    orderBy: [asc(tasks.number)],
  })
}

export type PlannerTask = NonNullable<Awaited<ReturnType<typeof getPlannerTasks>>>[number]

export async function getTaskWithRelations(id: string) {
  return db.query.tasks.findFirst({
    where: eq(tasks.id, id),
    with: {
      assignees: { with: { user: true } },
      comments: { orderBy: [asc(comments.createdAt)] },
    },
  })
}

export async function getTeamUsers() {
  return db.query.users.findMany({
    where: eq(users.status, "active"),
    orderBy: [asc(users.name)],
  })
}

export type TeamUser = NonNullable<Awaited<ReturnType<typeof getTeamUsers>>>[number]

export async function findUserByEmail(email: string) {
  return db.query.users.findFirst({ where: eq(users.email, email.toLowerCase()) })
}

/* ---------- user directory (Team / Admins pages) ---------- */

/* Every account, active and inactive, with the number of tasks still in play
   for each one. The count is a correlated subquery so one round trip covers
   the whole table however long the team gets. */
export async function getDirectoryUsers() {
  const openTasks = db
    .select({ value: count() })
    .from(taskAssignees)
    .innerJoin(tasks, eq(tasks.id, taskAssignees.taskId))
    .where(
      and(
        eq(taskAssignees.userId, users.id),
        isNull(tasks.deletedAt),
        ne(tasks.stage, "posted"),
      ),
    )

  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      status: users.status,
      avatarBg: users.avatarBg,
      avatarFg: users.avatarFg,
      avatarUrl: users.avatarUrl,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      openTasks: sql<number>`(${openTasks})`.mapWith(Number),
    })
    .from(users)
    .orderBy(asc(users.name))
}

export type DirectoryUser = Awaited<ReturnType<typeof getDirectoryUsers>>[number]

export async function findUserById(id: string) {
  return db.query.users.findFirst({ where: eq(users.id, id) })
}

/* Guards the "you can't remove the last owner" rule. */
export async function countActiveSuperAdmins() {
  const [row] = await db
    .select({ value: count() })
    .from(users)
    .where(and(eq(users.role, "super_admin"), eq(users.status, "active")))

  return row?.value ?? 0
}

/* ---------- settings (JSONB key-value, no migration per key) ---------- */

export const CREDIT_RATE_KEY = "credit_rate"
export const DEFAULT_CREDIT_RATE = 5

export async function getSetting<T>(key: string): Promise<T | null> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, key) })
  return row ? (row.value as T) : null
}

export async function setSetting(key: string, value: unknown, updatedBy: string | null) {
  await db
    .insert(settings)
    .values({ key, value, updatedBy })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedBy } })
}

export async function getCreditRate() {
  const value = await getSetting<number>(CREDIT_RATE_KEY)
  return typeof value === "number" ? value : DEFAULT_CREDIT_RATE
}

/* ---------- website leads ---------- */

export async function getLeads() {
  return db.query.leads.findMany({
    where: isNull(leads.deletedAt),
    with: {
      assignee: true,
      activities: { orderBy: [asc(leadActivities.createdAt)] },
    },
    orderBy: [desc(leads.createdAt)],
  })
}

export type LeadRecord = NonNullable<Awaited<ReturnType<typeof getLeads>>>[number]

export async function getLeadWithRelations(id: string) {
  return db.query.leads.findFirst({
    where: eq(leads.id, id),
    with: {
      assignee: true,
      activities: { orderBy: [asc(leadActivities.createdAt)] },
    },
  })
}
