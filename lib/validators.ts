import { z } from "zod"

import {
  activityTypeSchema,
  leadStageSchema,
  prioritySchema,
  roleSchema,
  taskStageSchema,
  taskTypeSchema,
  userStatusSchema,
} from "@/lib/db/enums"

/* route params are user input too: a non-uuid id must 404, not reach Postgres
   and fail the query with an invalid uuid syntax error */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string) {
  return UUID_PATTERN.test(value)
}

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
})

export type LoginInput = z.infer<typeof loginSchema>

const dueDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date")
  .refine((value) => {
    const [y, m, d] = value.split("-").map(Number)
    const date = new Date(Date.UTC(y!, m! - 1, d!))
    return date.getUTCFullYear() === y && date.getUTCMonth() === m! - 1 && date.getUTCDate() === d
  }, "Enter a valid date")
  .nullable()

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, "Task title is required").max(120),
  type: taskTypeSchema.default("post"),
  desc: z.string().trim().default(""),
  prompt: z.string().trim().default(""),
  ref: z.string().trim().default(""),
  link: z.string().trim().default(""),
  due: dueDateSchema.default(null),
  cost: z.coerce.number().min(0).default(0),
  priority: prioritySchema.default("medium"),
  stage: taskStageSchema.default("new"),
  revision: z.string().trim().nullable().default(null),
  assigneeIds: z.array(z.string().uuid()).default([]),
  initialComments: z.array(z.string().trim().min(1)).default([]),
})
export type TaskCreateInput = z.infer<typeof taskCreateSchema>

export const taskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  type: taskTypeSchema.optional(),
  desc: z.string().trim().optional(),
  prompt: z.string().trim().optional(),
  ref: z.string().trim().optional(),
  link: z.string().trim().optional(),
  due: dueDateSchema.optional(),
  cost: z.coerce.number().min(0).optional(),
  priority: prioritySchema.optional(),
  stage: taskStageSchema.optional(),
  revision: z.string().trim().nullable().optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
})
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>

export const commentCreateSchema = z.object({
  text: z.string().trim().min(1, "Comment can't be empty").max(4000),
})
export type CommentCreateInput = z.infer<typeof commentCreateSchema>

/* ---------- user administration ---------- */

/* One rule for every place a password is set: by an admin on creation, by an
   admin on reset, and by the user themselves in Settings. */
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be 72 characters or fewer")

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour")

/* set by the FileUpload flow (GHL media CDN url); null clears a photo back to the initials avatar */
const avatarUrlSchema = z.string().trim().url("Enter a valid url").nullable()

export const userCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: passwordSchema,
  role: roleSchema.default("member"),
  avatarBg: hexColorSchema.default("#e6dcf7"),
  avatarFg: hexColorSchema.default("#5a2d9c"),
  avatarUrl: avatarUrlSchema.default(null),
})
export type UserCreateInput = z.infer<typeof userCreateSchema>

export const userUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email").optional(),
  role: roleSchema.optional(),
  status: userStatusSchema.optional(),
  avatarBg: hexColorSchema.optional(),
  avatarFg: hexColorSchema.optional(),
  avatarUrl: avatarUrlSchema.optional(),
})
export type UserUpdateInput = z.infer<typeof userUpdateSchema>

export const passwordResetSchema = z.object({
  password: passwordSchema,
})
export type PasswordResetInput = z.infer<typeof passwordResetSchema>

/* ---------- own account ---------- */

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80).optional(),
  avatarBg: hexColorSchema.optional(),
  avatarFg: hexColorSchema.optional(),
  avatarUrl: avatarUrlSchema.optional(),
})
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "The new password must be different",
    path: ["newPassword"],
  })
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>

/* ---------- settings ---------- */

export const settingsUpdateSchema = z.object({
  creditRate: z.coerce.number().min(0, "Rate can't be negative").max(100000).optional(),
})
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>

/* ---------- website leads ---------- */

const followUpSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date")
  .refine((value) => {
    const [y, m, d] = value.split("-").map(Number)
    const date = new Date(Date.UTC(y!, m! - 1, d!))
    return date.getUTCFullYear() === y && date.getUTCMonth() === m! - 1 && date.getUTCDate() === d
  }, "Enter a valid date")
  .nullable()

export const leadCreateSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().max(80).default(""),
  phone: z.string().trim().max(40).default(""),
  email: z.string().trim().max(254).default(""),
  business: z.string().trim().max(160).default(""),
  info: z.string().trim().max(400).default(""),
  address: z.string().trim().max(240).default(""),
  country: z.string().trim().max(80).default(""),
  professional: z.string().trim().max(80).default(""),
  value: z.coerce.number().min(0).default(0),
  source: z.string().trim().max(120).default("Manual entry"),
  message: z.string().trim().max(2000).default(""),
  /* omitted -> first stage of the connected GHL pipeline */
  stage: leadStageSchema.optional(),
  assigneeId: z.string().uuid().nullable().default(null),
  followUp: followUpSchema.default(null),
})
export type LeadCreateInput = z.infer<typeof leadCreateSchema>

export const leadUpdateSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(254).optional(),
  business: z.string().trim().max(160).optional(),
  info: z.string().trim().max(400).optional(),
  address: z.string().trim().max(240).optional(),
  country: z.string().trim().max(80).optional(),
  professional: z.string().trim().max(80).optional(),
  value: z.coerce.number().min(0).optional(),
  source: z.string().trim().max(120).optional(),
  message: z.string().trim().max(2000).optional(),
  stage: leadStageSchema.optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  followUp: followUpSchema.optional(),
})
export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>

export const leadActivityCreateSchema = z.object({
  type: activityTypeSchema,
  text: z.string().trim().min(1, "Activity text can't be empty").max(4000),
})
export type LeadActivityCreateInput = z.infer<typeof leadActivityCreateSchema>
