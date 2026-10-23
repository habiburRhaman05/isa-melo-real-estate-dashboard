import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { PlannerView } from "@/components/planner/planner-view"
import { getCurrentUser } from "@/lib/auth"
import { getPlannerTasks, getTeamUsers } from "@/lib/db/queries"

export const metadata: Metadata = {
  title: "Social Planner",
}

export const dynamic = "force-dynamic"

export default async function PlannerPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const [tasks, users] = await Promise.all([getPlannerTasks(), getTeamUsers()])

  return <PlannerView user={user} initialTasks={tasks} initialUsers={users} />
}
