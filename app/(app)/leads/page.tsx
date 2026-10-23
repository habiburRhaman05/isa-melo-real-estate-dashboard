import type { Metadata } from "next"

import { LeadsView } from "@/components/leads/leads-view"
import { requireRole } from "@/lib/auth"
import { getLeads, getTeamUsers } from "@/lib/db/queries"
import { getLeadPipeline } from "@/lib/ghl-pipeline"

export const metadata: Metadata = {
  title: "Website Leads",
}

export const dynamic = "force-dynamic"

export default async function LeadsPage() {
  const user = await requireRole(["admin", "super_admin"])

  /* resolve the pipeline first: connecting a pipeline remaps any leads that
     still carry an old stage id, and the list must reflect that remap */
  const pipeline = await getLeadPipeline()
  const [leads, users] = await Promise.all([getLeads(), getTeamUsers()])

  return (
    <LeadsView
      user={user}
      initialLeads={leads}
      initialUsers={users}
      initialStages={pipeline.stages}
      pipelineName={pipeline.name}
      ghlConnected={pipeline.connected}
    />
  )
}
