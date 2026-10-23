import type { Metadata } from "next"

import { DirectoryView } from "@/components/directory/directory-view"
import { requireRole } from "@/lib/auth"
import { getDirectoryUsers } from "@/lib/db/queries"

export const metadata: Metadata = {
  title: "Team",
}

export const dynamic = "force-dynamic"

export default async function TeamPage() {
  const user = await requireRole(["admin", "super_admin"])
  const users = await getDirectoryUsers()

  return (
    <DirectoryView
      currentUser={user}
      initialUsers={users}
      roles={["member"]}
      defaultRole="member"
      eyebrow="Team management"
      title="Team"
      intro="Everyone who works the board, what they are carrying, and how they get in."
      addLabel="Add member"
      emptyLabel="No team members yet. Add the first one to start assigning tasks."
    />
  )
}
