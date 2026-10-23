"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

import { useToast } from "@/components/toast"
import type { LeadRecord } from "@/lib/db/queries"
import { displayLeadId, PROFESSIONAL_OPTIONS } from "@/lib/leads"

type Draft = {
  firstName: string
  lastName: string
  phone: string
  email: string
  business: string
  info: string
  address: string
  country: string
  professional: string
  value: string
  message: string
}

const EMPTY_DRAFT: Draft = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  business: "",
  info: "",
  address: "",
  country: "",
  professional: "",
  value: "0",
  message: "",
}

export function AddLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated?: () => void }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, value: Number(draft.value) || 0 }),
      })
      const data = (await res.json().catch(() => null)) as {
        error?: string
        lead?: LeadRecord
        sync?: { error?: string }
      } | null
      if (!res.ok) throw new Error(data?.error ?? "Failed to add lead")
      return data
    },
    onSuccess: (data) => {
      /* an active search or country filter would hide the lead that was just
         saved (and every other one), so show the full list again */
      onCreated?.()
      void queryClient.invalidateQueries({ queryKey: ["leads"] })
      toast(`${displayLeadId(data?.lead?.number ?? 0)} added`)
      if (data?.sync?.error) toast(`GoHighLevel sync failed: ${data.sync.error}`)
      onClose()
    },
    onError: (err: Error) => setError(err.message),
  })

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!draft.firstName.trim()) {
      setError("First name is required")
      return
    }
    setError(null)
    createMutation.mutate()
  }

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
        className="modal"
        style={{ width: "min(680px,100%)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-lead-title"
        initial={{ opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.985 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <div className="m-head">
          <div>
            <div className="eyebrow">NEW LEAD</div>
            <h2 id="add-lead-title">Add lead</h2>
          </div>
          <button type="button" className="x" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="addg">
            <div className="fld">
              <label htmlFor="n_first">First name *</label>
              <input
                id="n_first"
                type="text"
                value={draft.firstName}
                onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
                required
              />
            </div>
            <div className="fld">
              <label htmlFor="n_last">Last name</label>
              <input id="n_last" type="text" value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
            </div>
            <div className="fld">
              <label htmlFor="n_phone">Phone</label>
              <input id="n_phone" type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            </div>
            <div className="fld">
              <label htmlFor="n_email">Email</label>
              <input id="n_email" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </div>
            <div className="fld">
              <label htmlFor="n_business">Business</label>
              <input id="n_business" type="text" value={draft.business} onChange={(e) => setDraft({ ...draft, business: e.target.value })} />
            </div>
            <div className="fld">
              <label htmlFor="n_info">Business info</label>
              <input id="n_info" type="text" value={draft.info} onChange={(e) => setDraft({ ...draft, info: e.target.value })} />
            </div>
            <div className="fld full">
              <label htmlFor="n_address">Address</label>
              <input id="n_address" type="text" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
            </div>
            <div className="fld">
              <label htmlFor="n_country">Country</label>
              <input id="n_country" type="text" value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} />
            </div>
            <div className="fld">
              <label htmlFor="n_pro">Professional</label>
              <select id="n_pro" value={draft.professional} onChange={(e) => setDraft({ ...draft, professional: e.target.value })}>
                <option value="">Not set</option>
                {PROFESSIONAL_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="fld">
              <label htmlFor="n_value">
                Opportunity value <span className="hint">(USD)</span>
              </label>
              <input id="n_value" type="number" min={0} step="1" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
            </div>
            <div className="fld full">
              <label htmlFor="n_msg">Message</label>
              <textarea id="n_msg" placeholder="What did they ask for?" value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} />
            </div>
            {error ? (
              <div className="full fmsg err" role="alert">
                {error}
              </div>
            ) : null}
          </div>
          <div className="m-foot standalone">
            <div className="right">
              <button type="button" className="btn-ghost" onClick={onClose} disabled={createMutation.isPending}>
                Cancel
              </button>
              <button type="submit" className="btn-brand" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                {createMutation.isPending ? "Saving" : "Save lead"}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
