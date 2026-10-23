import { z } from "zod"

/* Value lists are the single source of truth. Columns store plain text;
   adding a stage or type later is a code change with zero migrations. */

export const ROLES = ["member", "admin", "super_admin"] as const
export const USER_STATUSES = ["active", "inactive"] as const
export const TASK_STAGES = ["new", "working", "review", "revision", "approved", "posted"] as const
export const TASK_TYPES = ["post", "reel", "video", "image"] as const
export const PRIORITIES = ["high", "medium", "low"] as const
/* Offline fallback only. When GoHighLevel is configured the real stage list is
   read from the "Dubai Off Plan Sales" pipeline and stored in settings; lead
   rows then carry those GHL stage ids in the same text column. */
export const LEAD_STAGES = ["new", "contacted", "qualified", "proposal", "won", "lost"] as const
export const ACTIVITY_TYPES = ["note", "call", "email", "meeting", "message", "created", "stage", "update"] as const

/* stages only admins can move cards into (mirrors the prototype's team lock) */
export const OWNER_ONLY_STAGES = ["approved", "posted"] as const

/* free-text suggestions, not enforced: the list may grow per client */
export const PROFESSIONAL_SUGGESTIONS = [
  "Realtor",
  "Investor",
  "Developer",
  "Business owner",
  "Architect",
  "Other",
] as const

export const roleSchema = z.enum(ROLES)
export const userStatusSchema = z.enum(USER_STATUSES)
export const taskStageSchema = z.enum(TASK_STAGES)
export const taskTypeSchema = z.enum(TASK_TYPES)
export const prioritySchema = z.enum(PRIORITIES)
/* stage ids come from GHL at runtime, so only require a non-empty string */
export const leadStageSchema = z.string().trim().min(1).max(120)
export const activityTypeSchema = z.enum(ACTIVITY_TYPES)

export type Role = (typeof ROLES)[number]
export type UserStatus = (typeof USER_STATUSES)[number]
export type TaskStage = (typeof TASK_STAGES)[number]
export type TaskType = (typeof TASK_TYPES)[number]
export type Priority = (typeof PRIORITIES)[number]
export type LeadStage = string
export type ActivityType = (typeof ACTIVITY_TYPES)[number]
