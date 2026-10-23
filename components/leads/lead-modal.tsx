"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { Loader2, Mail, MessageCircle, Phone } from "lucide-react"
import { useEffect, useState } from "react"

import { Avatar } from "@/components/avatar"
import { useToast } from "@/components/toast"
import type { SessionUser } from "@/lib/auth"
import type { ActivityType } from "@/lib/db/enums"
import type { LeadRecord, TeamUser } from "@/lib/db/queries"
import {
  daysInPipeline,
  displayLeadId,
  fmtRelativeTime,
  followUpQuickDate,
  isClosedStage,
  leadAvatarColors,
  leadName,
  type LeadPipelineStage,
  PROFESSIONAL_OPTIONS,
  stageInfo,
} from "@/lib/leads"

const ACTIVITY_TYPES: { id: ActivityType; label: string }[] = [
  { id: "note", label: "Note" },
  { id: "call", label: "Call" },
  { id: "email", label: "Email" },
  { id: "meeting", label: "Meeting" },
  { id: "message", label: "Message" },
]

const ACTIVITY_LABEL: Record<string, string> = {
  note: "Note",
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  message: "Message",
  created: "Lead created",
  stage: "Stage change",
  update: "Update",
}

type ContactDraft = {
  firstName: string
  lastName: string
  phone: string
  email: string
  business: string
  info: string
  address: string
  country: string
  professional: string
}

function toContactDraft(lead: LeadRecord): ContactDraft {
  return {
    firstName: lead.firstName,
    lastName: lead.lastName,
    phone: lead.phone,
    email: lead.email,
    business: lead.business,
    info: lead.info,
    address: lead.address,
    country: lead.country,
    professional: lead.professional,
  }
}

async function patchLead(id: string, body: unknown): Promise<{ lead: LeadRecord; sync?: { error?: string } }> {
  const res = await fetch(`/api/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => null)) as {
    error?: string
    lead?: LeadRecord
    sync?: { error?: string }
  } | null
  if (!res.ok) throw new Error(data?.error ?? "Something went wrong")
  return { lead: data!.lead!, sync: data?.sync }
}

export function LeadModal({
  lead,
  users,
  stages,
  currentUser,
  onClose,
}: {
  lead: LeadRecord
  users: TeamUser[]
  stages: LeadPipelineStage[]
  currentUser: SessionUser
  onClose: () => void
}) {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [editingContact, setEditingContact] = useState(false)
  const [contactDraft, setContactDraft] = useState<ContactDraft>(() => toContactDraft(lead))
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [activityType, setActivityType] = useState<ActivityType>("note")
  const [activityText, setActivityText] = useState("")

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["leads"] })
  }

  function notifySync(result: { sync?: { error?: string } }) {
    if (result.sync?.error) toast(`GoHighLevel sync failed: ${result.sync.error}`)
  }

  const fieldMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => patchLead(lead.id, body),
    onSuccess: (result) => {
      invalidate()
      notifySync(result)
    },
    onError: (error: Error) => toast(error.message),
  })

  const saveContactMutation = useMutation({
    mutationFn: () => patchLead(lead.id, contactDraft),
    onSuccess: (result) => {
      invalidate()
      toast("Details saved")
      notifySync(result)
      setEditingContact(false)
    },
    onError: (error: Error) => toast(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/leads/${lead.id}`, { method: "DELETE" }).then(async (res) => {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        if (!res.ok) throw new Error(data?.error ?? "Failed to delete lead")
      }),
    onSuccess: () => {
      invalidate()
      toast("Lead deleted")
      onClose()
    },
    onError: (error: Error) => toast(error.message),
  })

  const addActivityMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/leads/${lead.id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: activityType, text: activityText.trim() }),
      }).then(async (res) => {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        if (!res.ok) throw new Error(data?.error ?? "Failed to log activity")
      }),
    onSuccess: () => {
      invalidate()
      setActivityText("")
      toast("Activity logged")
    },
    onError: (error: Error) => toast(error.message),
  })

  function onDeleteClick() {
    if (!deleteArmed) {
      setDeleteArmed(true)
      return
    }
    deleteMutation.mutate()
  }

  function logActivity() {
    const text = activityText.trim()
    if (!text) return
    addActivityMutation.mutate()
  }

  const stage = stageInfo(lead.stage, stages)
  const stageIdx = stages.findIndex((s) => s.id === lead.stage)
  const progressColor = !isClosedStage(lead.stage, stages)
    ? undefined
    : /lost|abandon/i.test(stage.name)
      ? "#c0364a"
      : "#2f9e6e"
  const avatar = leadAvatarColors(lead.number)
  const whatsapp = lead.phone.replace(/\D/g, "")
  const daysOpen = daysInPipeline(lead.createdAt, lead.closedAt)
  const lastActivity = lead.activities[lead.activities.length - 1]
  const isQuickFollowUp = (days: number) => lead.followUp === followUpQuickDate(days)

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
        className="modal lm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-modal-title"
        initial={{ opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.985 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <div className="m-head">
          <div>
            <div className="eyebrow">LEAD · {displayLeadId(lead.number)}</div>
            <div className="lh">
              <h2 id="lead-modal-title">{leadName(lead)}</h2>
              <span className="sp" style={{ background: stage.bg, color: stage.fg }}>
                <i style={{ background: stage.color }} />
                {stage.name}
              </span>
            </div>
          </div>
          <button type="button" className="x" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="lbody">
          {/* ---------- Contact ---------- */}
          <div className="pane">
            <div className="ph">
              <div className="pane-t">Contact</div>
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setContactDraft(toContactDraft(lead))
                  setEditingContact((prev) => !prev)
                }}
              >
                {editingContact ? "Cancel" : "Edit details"}
              </button>
            </div>

            {editingContact ? (
              <form
                className="flex flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  saveContactMutation.mutate()
                }}
              >
                {(
                  [
                    ["firstName", "First name"],
                    ["lastName", "Last name"],
                    ["phone", "Phone"],
                    ["email", "Email"],
                    ["business", "Business"],
                    ["info", "Business info"],
                    ["address", "Address"],
                    ["country", "Country"],
                  ] as const
                ).map(([key, label]) => (
                  <div className="fld" key={key}>
                    <label htmlFor={`lf-${key}`}>{label}</label>
                    <input
                      id={`lf-${key}`}
                      type="text"
                      value={contactDraft[key]}
                      onChange={(e) => setContactDraft({ ...contactDraft, [key]: e.target.value })}
                    />
                  </div>
                ))}
                <div className="fld">
                  <label htmlFor="lf-professional">Professional</label>
                  <select
                    id="lf-professional"
                    value={contactDraft.professional}
                    onChange={(e) => setContactDraft({ ...contactDraft, professional: e.target.value })}
                  >
                    <option value="">Not set</option>
                    {PROFESSIONAL_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="btn-brand" disabled={saveContactMutation.isPending}>
                  {saveContactMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                  {saveContactMutation.isPending ? "Saving" : "Save details"}
                </button>
              </form>
            ) : (
              <>
                <div className="who">
                  <Avatar name={lead.firstName} bg={avatar.bg} fg={avatar.fg} size={52} className="big" />
                  <div>
                    <div className="wn">{leadName(lead)}</div>
                    <div className="muted">
                      {lead.professional || "Not set"} · {lead.business || "No business"}
                    </div>
                  </div>
                </div>
                <div className="chips">
                  {lead.phone ? (
                    <a className="chip" href={`tel:${lead.phone.replace(/\s/g, "")}`}>
                      <Phone size={14} />
                      Call
                    </a>
                  ) : null}
                  {lead.email ? (
                    <a className="chip" href={`mailto:${lead.email}`}>
                      <Mail size={14} />
                      Email
                    </a>
                  ) : null}
                  {whatsapp ? (
                    <a className="chip" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircle size={14} />
                      WhatsApp
                    </a>
                  ) : null}
                </div>
                <div>
                  <div className="kv">
                    <span>Phone</span>
                    <div>
                      {lead.phone ? <a href={`tel:${lead.phone.replace(/\s/g, "")}`}>{lead.phone}</a> : "Not set"}
                    </div>
                  </div>
                  <div className="kv">
                    <span>Email</span>
                    <div>{lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : "Not set"}</div>
                  </div>
                  <div className="kv">
                    <span>Business</span>
                    <div>{lead.business || "Not set"}</div>
                  </div>
                  <div className="kv">
                    <span>Business info</span>
                    <div>{lead.info || "Not set"}</div>
                  </div>
                  <div className="kv">
                    <span>Address</span>
                    <div>{lead.address || "Not set"}</div>
                  </div>
                  <div className="kv">
                    <span>Country</span>
                    <div>{lead.country || "Not set"}</div>
                  </div>
                  <div className="kv">
                    <span>Source</span>
                    <div>{lead.source}</div>
                  </div>
                  <div className="kv">
                    <span>Created</span>
                    <div>{new Date(lead.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                  </div>
                </div>
                {lead.message ? (
                  <div className="msgb">
                    <b>Website message</b>
                    {lead.message}
                  </div>
                ) : null}
              </>
            )}
          </div>

          {/* ---------- Pipeline and follow-up ---------- */}
          <div className="pane">
            <div className="pane-t">Pipeline and follow-up</div>
            <div className="prog" style={{ "--prog-steps": stages.length } as React.CSSProperties}>
              {stages.map((s, i) => (
                <i
                  key={s.id}
                  className={i <= stageIdx ? "f" : ""}
                  style={i <= stageIdx && progressColor ? { background: progressColor } : undefined}
                />
              ))}
            </div>
            <div className="fld">
              <span className="lbl">
                Stage <span className="hint">(logged on the timeline)</span>
              </span>
              <div className="sg">
                {stages.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`sb ${s.id === lead.stage ? "on" : ""}`.trim()}
                    disabled={fieldMutation.isPending}
                    onClick={() => s.id !== lead.stage && fieldMutation.mutate({ stage: s.id })}
                  >
                    <span className="dot" style={{ width: 8, height: 8, borderRadius: 999, background: s.color, display: "inline-block" }} />
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="ms">
              <div>
                <span>In pipeline</span>
                <b>
                  {daysOpen} day{daysOpen === 1 ? "" : "s"}
                </b>
              </div>
              <div>
                <span>Last activity</span>
                <b>{lastActivity ? fmtRelativeTime(lastActivity.createdAt) : "None"}</b>
              </div>
              <div>
                <span>Activities</span>
                <b>{lead.activities.length}</b>
              </div>
            </div>
            <div className="fld">
              <label htmlFor="lVal">
                Opportunity value <span className="hint">(USD)</span>
              </label>
              <input
                id="lVal"
                type="number"
                min={0}
                step="1"
                defaultValue={Number(lead.value) || 0}
                onBlur={(e) => {
                  const next = Math.max(0, Number(e.target.value) || 0)
                  if (next !== Number(lead.value)) fieldMutation.mutate({ value: next })
                }}
              />
            </div>
            <div className="fld">
              <label htmlFor="lFu">Next follow-up</label>
              <input
                id="lFu"
                type="date"
                defaultValue={lead.followUp ?? ""}
                onChange={(e) => fieldMutation.mutate({ followUp: e.target.value || null })}
              />
              <div className="chips">
                <button
                  type="button"
                  className={`chip ${isQuickFollowUp(1) ? "on" : ""}`.trim()}
                  onClick={() => fieldMutation.mutate({ followUp: followUpQuickDate(1) })}
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  className={`chip ${isQuickFollowUp(3) ? "on" : ""}`.trim()}
                  onClick={() => fieldMutation.mutate({ followUp: followUpQuickDate(3) })}
                >
                  In 3 days
                </button>
                <button
                  type="button"
                  className={`chip ${isQuickFollowUp(7) ? "on" : ""}`.trim()}
                  onClick={() => fieldMutation.mutate({ followUp: followUpQuickDate(7) })}
                >
                  Next week
                </button>
                <button type="button" className="chip" onClick={() => fieldMutation.mutate({ followUp: null })}>
                  Clear
                </button>
              </div>
            </div>
            <div className="fld">
              <span className="lbl">Assigned to</span>
              <div className="chips">
                <button
                  type="button"
                  className={`chip ${!lead.assigneeId ? "on" : ""}`.trim()}
                  onClick={() => fieldMutation.mutate({ assigneeId: null })}
                >
                  Unassigned
                </button>
                {users.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    className={`chip ${lead.assigneeId === person.id ? "on" : ""}`.trim()}
                    onClick={() => fieldMutation.mutate({ assigneeId: person.id })}
                  >
                    <Avatar name={person.name} bg={person.avatarBg} fg={person.avatarFg} avatarUrl={person.avatarUrl} size={20} />
                    {person.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ---------- Activity ---------- */}
          <div className="pane">
            <div className="pane-t">Activity</div>
            <span className="lbl">Log activity</span>
            <div className="chips">
              {ACTIVITY_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`chip ${activityType === t.id ? "on" : ""}`.trim()}
                  onClick={() => setActivityType(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <textarea
              placeholder="What happened? e.g. Called, discussed budget and timeline (Ctrl+Enter to log)"
              value={activityText}
              onChange={(e) => setActivityText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  logActivity()
                }
              }}
            />
            <div className="logrow">
              <select aria-label="Logged by" disabled value={currentUser.name}>
                <option>{currentUser.name}</option>
              </select>
              <button type="button" className="btn-brand" disabled={addActivityMutation.isPending} onClick={logActivity}>
                {addActivityMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                {addActivityMutation.isPending ? "Logging" : "Log activity"}
              </button>
            </div>
            <div className="pane-t">Timeline ({lead.activities.length})</div>
            <div className="tl">
              {lead.activities.length > 0 ? (
                [...lead.activities]
                  .reverse()
                  .map((activity) => (
                    <div key={activity.id} className="ti">
                      <i className={activity.type === "created" ? "c" : ""}>{activity.type === "created" ? "+" : "•"}</i>
                      <div>
                        <b>{ACTIVITY_LABEL[activity.type] ?? activity.type}</b> <small>{activity.authorName}</small>
                        <p>{activity.text}</p>
                        <small>{fmtRelativeTime(activity.createdAt)}</small>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="muted">No activity logged yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="m-foot" style={{ margin: "0 28px 22px" }}>
          <button
            type="button"
            className={`btn-del ${deleteArmed ? "confirm" : ""}`.trim()}
            disabled={deleteMutation.isPending}
            onClick={onDeleteClick}
          >
            {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
            {deleteMutation.isPending ? "Deleting" : deleteArmed ? "Click again to delete" : "Delete lead"}
          </button>
          <div className="right">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
