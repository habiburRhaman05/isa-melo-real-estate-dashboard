import { redirect } from "next/navigation"

import { Topbar } from "@/components/topbar"
import { getCurrentUser } from "@/lib/auth"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  return (
    <>
      <Topbar user={user} />
      {children}
    </>
  )
}
