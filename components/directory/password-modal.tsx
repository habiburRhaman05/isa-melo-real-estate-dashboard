"use client"

import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

import type { DirectoryUser } from "@/lib/db/queries"

export function PasswordModal({
  user,
  saving,
  error,
  onSave,
  onClose,
}: {
  user: DirectoryUser
  saving: boolean
  error: string | null
  onSave: (password: string) => void
  onClose: () => void
}) {
  const [password, setPassword] = useState("")

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return (
    <motion.div
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <motion.div
        className="modal sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pw-modal-title"
        initial={{ opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.985 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <div className="m-head">
          <div>
            <div className="eyebrow">Reset password</div>
            <h2 id="pw-modal-title">{user.name}</h2>
          </div>
          <button type="button" className="x" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>
        <form
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault()
            onSave(password)
          }}
        >
          <div className="addg">
            <div className="fld full">
              <label htmlFor="rpPass">
                New password <span className="hint">(at least 8 characters)</span>
              </label>
              <input
                id="rpPass"
                type="text"
                autoComplete="new-password"
                placeholder="Share this with them"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <div className="full muted">
              Setting a new password signs {user.name} out of every device they are using.
            </div>
            {error ? (
              <div className="full fmsg err" role="alert">
                {error}
              </div>
            ) : null}
          </div>
          <div className="m-foot standalone">
            <div className="right">
              <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn-brand" disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                {saving ? "Setting" : "Set password"}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
