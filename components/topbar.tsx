"use client"

import { Loader2, LogOut } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { SessionUser } from "@/lib/auth"
import { NAV_ITEMS } from "@/lib/navigation"

import { Avatar } from "./avatar"

export function Topbar({ user }: { user: SessionUser }) {
  const pathname = usePathname()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role))

  async function signOut() {
    setSigningOut(true)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      router.push("/login")
      router.refresh()
    } catch {
      setSigningOut(false)
    }
  }

  return (
    <header className="topbar">
      <div className="flex items-center gap-[34px]">
        <div className="brand">Isa Melo Real Estate Dashboard</div>
        <nav className="nav" aria-label="Sections">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link key={item.href} href={item.href} className={active ? "on" : undefined}>
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Account menu" className="cursor-pointer rounded-full">
            <Avatar name={user.name} bg={user.avatarBg} fg={user.avatarFg} avatarUrl={user.avatarUrl} size={34} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>
            <span className="block text-caption font-semibold">{user.name}</span>
            <span className="block text-body-xs font-normal text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled className="text-caption text-muted-foreground">
            Role: {user.role.replace("_", " ")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={signingOut}
            onSelect={(event) => {
              event.preventDefault()
              void signOut()
            }}
            className="text-caption text-destructive focus:text-destructive"
          >
            {signingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
            {signingOut ? "Signing out" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
