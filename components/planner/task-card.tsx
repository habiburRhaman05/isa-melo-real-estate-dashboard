"use client"

import { Loader2, MessageSquare } from "lucide-react"

import { Avatar } from "@/components/avatar"
import type { PlannerTask } from "@/lib/db/queries"
import { displayId, dueInfo, linkLabel, money, PRIORITY_LABELS, typeName } from "@/lib/planner"

import { CARD_ICONS, TASK_TYPE_ICONS } from "./icons"

function isUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

export function TaskCard({
  task,
  onOpen,
  draggable = false,
  dragging = false,
  busy = false,
  onDragStart,
  onDragEnd,
}: {
  task: PlannerTask
  onOpen: (id: string) => void
  draggable?: boolean
  dragging?: boolean
  busy?: boolean
  onDragStart?: (id: string) => void
  onDragEnd?: () => void
}) {
  const due = dueInfo(task.due, task.stage)
  const TypeIcon = TASK_TYPE_ICONS[task.type]
  const assignees = task.assignees.map((a) => a.user).filter((u) => u !== null)
  const lastComment = task.comments[task.comments.length - 1]

  const refContent = task.ref ? (
    isUrl(task.ref) ? (
      <a href={task.ref} target="_blank" rel="noopener noreferrer">
        {linkLabel(task.ref)}
      </a>
    ) : (
      task.ref
    )
  ) : (
    <span className="none">Not set</span>
  )

  const linkContent = task.link ? (
    <a href={task.link} target="_blank" rel="noopener noreferrer">
      {linkLabel(task.link)}
    </a>
  ) : (
    <span className="none">Not submitted</span>
  )

  return (
    <article
      className={`card ${dragging ? "dragging" : ""} ${busy ? "busy" : ""}`.trim()}
      tabIndex={0}
      aria-label={`Edit ${task.title}`}
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move"
        try {
          event.dataTransfer.setData("text/plain", task.id)
        } catch {
          /* some browsers restrict setData outside a real drag */
        }
        onDragStart?.(task.id)
      }}
      onDragEnd={() => onDragEnd?.()}
      onClick={(event) => {
        /* let link clicks inside the card work without opening the modal */
        if ((event.target as HTMLElement).closest("a")) return
        onOpen(task.id)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) onOpen(task.id)
      }}
    >
      {busy ? (
        <span className="card-busy" aria-label="Moving task" role="status">
          <Loader2 size={13} className="animate-spin" />
        </span>
      ) : null}
      <div className="c-top">
        <span className="c-left">
          <span className="c-id">{displayId(task.number)}</span>
          <span className="type">
            <TypeIcon size={12} />
            {typeName(task.type)}
          </span>
        </span>
        <span className={`prio ${task.priority}`}>{PRIORITY_LABELS[task.priority]}</span>
      </div>
      <h3>{task.title}</h3>
      <p className="c-desc">{task.desc ? task.desc : <span className="none">No description</span>}</p>
      {task.revision ? (
        <div className="rev">
          <b>Revision requested</b>
          {task.revision}
        </div>
      ) : null}
      <div className="c-rows">
        <div className="row">
          <CARD_ICONS.ref size={14} />
          <span className="k">Reference</span>
          <span className="v">{refContent}</span>
        </div>
        <div className="row">
          <CARD_ICONS.link size={14} />
          <span className="k">Submission</span>
          <span className="v">{linkContent}</span>
        </div>
        <div className="row">
          <CARD_ICONS.prompt size={14} />
          <span className="k">Prompt</span>
          <span className="v">{task.prompt ? task.prompt : <span className="none">Not set</span>}</span>
        </div>
      </div>
      <div className="c-grid">
        <div>
          <span className="k">Created</span>
          <b>{new Date(task.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</b>
        </div>
        <div className={due.cls}>
          <span className="k">Due</span>
          <b>{due.text}</b>
        </div>
        <div>
          <span className="k">Cost</span>
          <b>{money(task.cost)}</b>
        </div>
      </div>
      <div className="c-foot">
        {assignees.length > 0 ? (
          <>
            <div className="stack">
              {assignees.map((user) => (
                <Avatar
                  key={user.id}
                  name={user.name}
                  bg={user.avatarBg}
                  fg={user.avatarFg}
                  avatarUrl={user.avatarUrl}
                />
              ))}
            </div>
            <span className="names">{assignees.map((user) => user.name).join(", ")}</span>
          </>
        ) : (
          <span className="names">Unassigned</span>
        )}
        <span className="cmt-count" title="Comments">
          <MessageSquare size={13} />
          {task.comments.length}
        </span>
      </div>
      {lastComment ? (
        <div className="last-cmt">
          <b>{lastComment.authorName}:</b> {lastComment.text}
        </div>
      ) : null}
    </article>
  )
}
