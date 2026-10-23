import type { Metadata } from "next"

import { DirectoryView } from "@/components/directory/directory-view"
import { requireRole } from "@/lib/auth"
import { getDirectoryUsers } from "@/lib/db/queries"

export const metadata: Metadata = {
  title: "Admins",
}

export const dynamic = "force-dynamic"

export default async function AdminsPage() {
  const user = await requireRole(["super_admin"])
  const users = await getDirectoryUsers()

  return (
    <DirectoryView
      currentUser={user}
      initialUsers={users}
      roles={["admin", "super_admin"]}
      defaultRole="admin"
      eyebrow="Admin management"
      title="Admins"
      intro="Who can approve work, manage the team, and change how the dashboard runs."
      addLabel="Add admin"
      emptyLabel="No admins yet."
    />
  )
}
