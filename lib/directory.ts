import type { Role, UserStatus } from "@/lib/db/enums"

export const ROLE_LABELS: Record<Role, string> = {
  member: "Team member",
  admin: "Admin",
  super_admin: "Super admin",
}

/* short form for table cells, where the column is already called "Role" */
export const ROLE_SHORT: Record<Role, string> = {
  member: "Member",
  admin: "Admin",
  super_admin: "Super admin",
}

export const STATUS_LABELS: Record<UserStatus, string> = {
  active: "Active",
  inactive: "Inactive",
}

/* The avatar colours the design already uses, offered as pairs so a new
   account can never end up with unreadable initials. */
export const AVATAR_PRESETS: { bg: string; fg: string }[] = [
  { bg: "#e6dcf7", fg: "#5a2d9c" },
  { bg: "#f6eac0", fg: "#8a6212" },
  { bg: "#d5eadf", fg: "#25704f" },
  { bg: "#fbe9c9", fg: "#8a5a0f" },
  { bg: "#fdecef", fg: "#b32d45" },
  { bg: "#eeeaf3", fg: "#6b6480" },
]

export function fmtLastLogin(value: Date | string | null) {
  if (!value) return "Never"
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
