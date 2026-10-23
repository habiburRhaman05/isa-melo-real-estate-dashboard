import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth"

import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "Sign in",
}

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/")

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-[400px]">
        <p className="eyebrow text-center">Isa Melo Real Estate</p>
        <h1 className="mt-3 text-center text-title font-serif">Welcome back</h1>
        <p className="mt-2 text-center text-body-sm text-muted-foreground">
          Sign in to the content pipeline
        </p>
        <LoginForm />
      </div>
    </main>
  )
}
