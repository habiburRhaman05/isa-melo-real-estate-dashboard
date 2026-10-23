import type { Role } from "@/lib/db/enums"

export const NAV_ITEMS: { href: string; label: string; roles: Role[] }[] = [
  { href: "/planner", label: "Social Planner", roles: ["member", "admin", "super_admin"] },
  { href: "/leads", label: "Website Leads", roles: ["admin", "super_admin"] },
  { href: "/team", label: "Team", roles: ["admin", "super_admin"] },
  { href: "/admins", label: "Admins", roles: ["super_admin"] },
  { href: "/settings", label: "Settings", roles: ["member", "admin", "super_admin"] },
]
