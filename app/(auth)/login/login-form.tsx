"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginSchema } from "@/lib/validators"

/* The redirect itself is near-instant, which reads as a flicker rather than a
   landing. Holding the branded splash for a beat (then letting the planner's
   own loading.tsx skeleton take over) is what makes it feel deliberate. */
const MIN_SPLASH_MS = 700

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [welcomeName, setWelcomeName] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const parsed = loginSchema.safeParse({ email, password })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid email and password")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      })
      const data = (await res.json().catch(() => null)) as
        | { error?: string; user?: { name: string } }
        | null

      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Try again.")
        setLoading(false)
        return
      }

      setWelcomeName(data?.user?.name ?? null)
      const started = Date.now()
      router.prefetch("/planner")
      const elapsed = Date.now() - started
      if (elapsed < MIN_SPLASH_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_SPLASH_MS - elapsed))
      }

      router.push("/")
      router.refresh()
    } catch {
      setError("Network error. Check your connection and try again.")
      setLoading(false)
    }
  }

  return (
    <AnimatePresence mode="wait">
      {welcomeName !== null ? (
        <motion.div
          key="splash"
          className="login-splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <motion.div
            className="login-splash-mark"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            IM
          </motion.div>
          <div className="login-splash-text">Welcome back, {welcomeName.split(" ")[0]}</div>
          <Loader2 className="size-5 animate-spin" />
          <div className="login-splash-sub">Preparing your dashboard</div>
        </motion.div>
      ) : (
        <motion.div
          key="form"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5 rounded-card border bg-card p-7 shadow-card">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="form-label">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@isamelo.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="form-label">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error ? (
              <div className="rounded-xl border border-destructive/30 bg-danger-soft px-3 py-2.5 text-caption text-danger-text">
                {error}
              </div>
            ) : null}
            <Button type="submit" disabled={loading} className="h-11 rounded-lg font-semibold shadow-button">
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              {loading ? "Signing in" : "Sign in"}
            </Button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
