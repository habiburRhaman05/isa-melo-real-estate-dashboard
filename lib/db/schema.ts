import { relations } from "drizzle-orm"
import {
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import {
  ACTIVITY_TYPES,
  PRIORITIES,
  ROLES,
  TASK_STAGES,
  TASK_TYPES,
} from "./enums"

/* Future-proofing rules baked into this schema:
   - UUID ids everywhere; display ids (T-101, L-1007) derive from a serial, never the PK
   - stage/type/priority are text columns validated by zod enums: extending them later
     is a code change, no destructive ALTER on existing rows
   - junction table for assignees: any number of members per task, cheap "my tasks" queries
   - soft deletes (deleted_at) on tasks/leads; users are deactivated (status), never deleted,
     so comment/activity/assignee history always survives
   - author name snapshots on comments/activities survive renames
   - settings is a JSONB key-value store: new settings need no migrations
   - sessions live in the DB so they can be revoked (password reset, deactivation) */

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("member").$type<(typeof ROLES)[number]>(),
  status: text("status").notNull().default("active").$type<"active" | "inactive">(),
  avatarBg: text("avatar_bg").notNull().default("#e6dcf7"),
  avatarFg: text("avatar_fg").notNull().default("#5a2d9c"),
  /* uploaded profile photo (GHL media CDN url); null falls back to the initials avatar */
  avatarUrl: text("avatar_url"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
)

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    number: serial("number").unique(),
    title: text("title").notNull(),
    desc: text("desc").notNull().default(""),
    prompt: text("prompt").notNull().default(""),
    ref: text("ref").notNull().default(""),
    link: text("link").notNull().default(""),
    type: text("type").notNull().default("post").$type<(typeof TASK_TYPES)[number]>(),
    priority: text("priority").notNull().default("medium").$type<(typeof PRIORITIES)[number]>(),
    stage: text("stage").notNull().default("new").$type<(typeof TASK_STAGES)[number]>(),
    /* numeric is exact decimal; costs/values never go through floats */
    cost: numeric("cost", { precision: 10, scale: 2 }).notNull().default("0"),
    due: date("due"),
    revision: text("revision"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("tasks_stage_idx").on(table.stage),
    index("tasks_due_idx").on(table.due),
    index("tasks_priority_idx").on(table.priority),
    index("tasks_created_by_idx").on(table.createdBy),
  ],
)

export const taskAssignees = pgTable(
  "task_assignees",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.userId] }),
    index("task_assignees_user_idx").on(table.userId),
  ],
)

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("comments_task_idx").on(table.taskId)],
)

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    number: serial("number").unique(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    business: text("business").notNull().default(""),
    info: text("info").notNull().default(""),
    address: text("address").notNull().default(""),
    country: text("country").notNull().default(""),
    professional: text("professional").notNull().default(""),
    value: numeric("value", { precision: 12, scale: 2 }).notNull().default("0"),
    source: text("source").notNull().default("Manual entry"),
    message: text("message").notNull().default(""),
    /* GHL "Dubai Off Plan Sales" stage id when a pipeline is connected, or an
       id from LEAD_STAGES while running offline */
    stage: text("stage").notNull().default("new"),
    /* links back to the mirrored GoHighLevel records, null for local-only leads */
    ghlContactId: text("ghl_contact_id"),
    ghlOpportunityId: text("ghl_opportunity_id"),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    followUp: date("follow_up"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("leads_stage_idx").on(table.stage),
    index("leads_country_idx").on(table.country),
    index("leads_follow_up_idx").on(table.followUp),
    index("leads_assignee_idx").on(table.assigneeId),
    index("leads_created_at_idx").on(table.createdAt),
    uniqueIndex("leads_ghl_contact_id_idx").on(table.ghlContactId),
    index("leads_ghl_opportunity_id_idx").on(table.ghlOpportunityId),
  ],
)

export const leadActivities = pgTable(
  "lead_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    type: text("type").notNull().$type<(typeof ACTIVITY_TYPES)[number]>(),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("lead_activities_lead_idx").on(table.leadId)],
)

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull().$type<unknown>(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    meta: jsonb("meta").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ],
)

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  taskAssignees: many(taskAssignees),
  comments: many(comments),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  createdByUser: one(users, { fields: [tasks.createdBy], references: [users.id] }),
  assignees: many(taskAssignees),
  comments: many(comments),
}))

export const taskAssigneesRelations = relations(taskAssignees, ({ one }) => ({
  task: one(tasks, { fields: [taskAssignees.taskId], references: [tasks.id] }),
  user: one(users, { fields: [taskAssignees.userId], references: [users.id] }),
}))

export const commentsRelations = relations(comments, ({ one }) => ({
  task: one(tasks, { fields: [comments.taskId], references: [tasks.id] }),
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
}))

export const leadsRelations = relations(leads, ({ one, many }) => ({
  assignee: one(users, { fields: [leads.assigneeId], references: [users.id] }),
  activities: many(leadActivities),
}))

export const leadActivitiesRelations = relations(leadActivities, ({ one }) => ({
  lead: one(leads, { fields: [leadActivities.leadId], references: [leads.id] }),
  author: one(users, { fields: [leadActivities.authorId], references: [users.id] }),
}))

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
export type Comment = typeof comments.$inferSelect
export type Lead = typeof leads.$inferSelect
export type NewLead = typeof leads.$inferInsert
export type LeadActivity = typeof leadActivities.$inferSelect
