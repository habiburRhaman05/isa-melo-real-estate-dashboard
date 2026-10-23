"use client"

import { Loader2, MessageCircle } from "lucide-react"

import { Avatar } from "@/components/avatar"
import type { LeadRecord } from "@/lib/db/queries"
import { followUpInfo, leadAvatarColors, leadMoney, leadName, type LeadPipelineStage } from "@/lib/leads"

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

export function LeadCard({
  lead,
  stages,
  onOpen,
  draggable = false,
  dragging = false,
  busy = false,
  onDragStart,
  onDragEnd,
}: {
  lead: LeadRecord
  stages: LeadPipelineStage[]
  onOpen: (id: string) => void
  draggable?: boolean
  dragging?: boolean
  busy?: boolean
  onDragStart?: (id: string) => void
  onDragEnd?: () => void
}) {
  const avatar = leadAvatarColors(lead.number)
  const lastActivity = lead.activities[lead.activities.length - 1]
  const followUp = followUpInfo(lead, stages)

  return (
    <article
      className={`lc ${dragging ? "dragging" : ""} ${busy ? "busy" : ""}`.trim()}
      draggable={draggable}
      aria-busy={busy || undefined}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move"
        try {
          event.dataTransfer.setData("text/plain", lead.id)
        } catch {
          /* some browsers restrict setData outside a real drag */
        }
        onDragStart?.(lead.id)
      }}
      onDragEnd={() => onDragEnd?.()}
      onClick={() => onOpen(lead.id)}
    >
      {busy ? (
        <span className="card-busy" aria-label="Moving lead" role="status">
          <Loader2 size={13} className="animate-spin" />
        </span>
      ) : null}
      <div className="nm">
        <Avatar name={lead.firstName} bg={avatar.bg} fg={avatar.fg} />
        <span>
          <b>{leadName(lead)}</b>
          <small>{lead.business}</small>
        </span>
      </div>
      <div className="tags">
        <span className="pp">{lead.professional}</span>
        <span className="tag">{lead.country}</span>
      </div>
      <div className="lv">{leadMoney(lead.value)}</div>
      {lastActivity ? (
        <div className="snip">
          <b>{ACTIVITY_LABEL[lastActivity.type] ?? lastActivity.type}:</b> {lastActivity.text}
        </div>
      ) : null}
      <div className="lf">
        <span className={followUp.cls}>{followUp.text}</span>
        <span className="cc">
          <MessageCircle size={13} />
          {lead.activities.length}
          {lead.assignee ? (
            <Avatar
              name={lead.assignee.name}
              bg={lead.assignee.avatarBg}
              fg={lead.assignee.avatarFg}
              avatarUrl={lead.assignee.avatarUrl}
              size={22}
              className="sm"
            />
          ) : null}
        </span>
      </div>
    </article>
  )
}
