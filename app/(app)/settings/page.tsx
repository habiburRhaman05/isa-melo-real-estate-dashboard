import type { Metadata } from "next"

import { SettingsView } from "@/components/settings/settings-view"
import { requireUser } from "@/lib/auth"
import { getCreditRate } from "@/lib/db/queries"

export const metadata: Metadata = {
  title: "Settings",
}

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const user = await requireUser()
  const creditRate = await getCreditRate()

  return <SettingsView user={user} creditRate={creditRate} />
}
