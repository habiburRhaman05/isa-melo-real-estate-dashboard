"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { Fragment, useEffect, useState } from "react"

import { Avatar } from "@/components/avatar"
import { FileUpload } from "@/components/file-upload"
import { useToast } from "@/components/toast"
import type { SessionUser } from "@/lib/auth"
import { OWNER_ONLY_STAGES, type Priority, type TaskStage, type TaskType } from "@/lib/db/enums"
import type { PlannerTask, TeamUser } from "@/lib/db/queries"
import { canSetSubmissionLink, isOwnerRole } from "@/lib/permissions"
import { displayId, fmtTime, STAGES, TYPES } from "@/lib/planner"

import { TASK_TYPE_ICONS } from "./icons"

/* GHL media storage rejects file types it doesn't recognise (generic
   .zip/.bin/etc come back "Invalid File Type"); steer the picker toward
   what it actually accepts instead of letting people hit that error. */
const SUPPORTED_UPLOAD_TYPES =
  "image/*,video/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt"

type FormState = {
  title: string
  type: TaskType
  desc: string
  prompt: string
  ref: string
  link: string
  due: string
  cost: string
  priority: Priority
  stage: TaskStage
  revision: string
  assigneeIds: string[]
}

type DraftComment = { id: string; text: string }

function toFormState(task: PlannerTask | null): FormState {
  if (!task) {
    return {
      title: "",
      type: "post",
      desc: "",
      prompt: "",
      ref: "",
      link: "",
      due: "",
      cost: "0",
      priority: "medium",
      stage: "new",
      revision: "",
      assigneeIds: [],
    }
  }
  return {
    title: task.title,
    type: task.type,
    desc: task.desc,
    prompt: task.prompt,
    ref: task.ref,
    link: task.link,
    due: task.due ?? "",
    cost: task.cost,
    priority: task.priority,
    stage: task.stage,
    revision: task.revision ?? "",
    assigneeIds: task.assignees.map((a) => a.userId),
  }
}

async function postJSON(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = (await res.json().catch(() => null)) as { error?: string; task?: PlannerTask } | null
  if (!res.ok) {
    throw new Error(data?.error ?? "Something went wrong")
  }
  return data
}

export function TaskModal({
  task,
  users,
  currentUser,
  onClose,
  onCreated,
}: {
  task: PlannerTask | null
  users: TeamUser[]
  currentUser: SessionUser
  onClose: () => void
  /* fires only after a successful create, separately from onClose (which also
     fires on Cancel) - lets the board clear stale filters so the new task is
     actually visible instead of looking like everything just vanished. */
  onCreated?: () => void
}) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const isCreate = task === null
  const isOwner = isOwnerRole(currentUser)
  const canEdit = isCreate || isOwner || (task?.assignees.some((a) => a.userId === currentUser.id) ?? false)
  /* the submission link belongs to the team; owners only ever read it */
  const canEditLink = !isCreate && canEdit && canSetSubmissionLink(currentUser)

  const [form, setForm] = useState<FormState>(() => toFormState(task))
  const [draftComments, setDraftComments] = useState<DraftComment[]>([])
  const [commentText, setCommentText] = useState("")
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["planner", "tasks"] })
  }

  const createMutation = useMutation({
    mutationFn: () =>
      postJSON("/api/tasks", "POST", {
        title: form.title.trim(),
        type: form.type,
        desc: form.desc.trim(),
        prompt: form.prompt.trim(),
        ref: form.ref.trim(),
        ...(canEditLink ? { link: form.link.trim() } : {}),
        due: form.due || null,
        cost: Number(form.cost) || 0,
        priority: form.priority,
        stage: form.stage,
        revision: form.revision.trim() || null,
        assigneeIds: form.assigneeIds,
        initialComments: draftComments.map((c) => c.text),
      }),
    onSuccess: (data) => {
      invalidate()
      toast(`${displayId(data?.task?.number ?? 0)} created`)
      onCreated?.()
      onClose()
    },
    onError: (error: Error) => toast(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!task) throw new Error("No task to update")
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        type: form.type,
        desc: form.desc.trim(),
        prompt: form.prompt.trim(),
        ref: form.ref.trim(),
        ...(canEditLink ? { link: form.link.trim() } : {}),
        due: form.due || null,
        cost: Number(form.cost) || 0,
        priority: form.priority,
        stage: form.stage,
      }
      if (isOwner) {
        payload.revision = form.revision.trim() || null
        payload.assigneeIds = form.assigneeIds
      }
      return postJSON(`/api/tasks/${task.id}`, "PATCH", payload)
    },
    onSuccess: () => {
      invalidate()
      toast(`${displayId(task!.number)} saved`)
      onClose()
    },
    onError: (error: Error) => toast(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!task) throw new Error("No task to delete")
      return postJSON(`/api/tasks/${task.id}`, "DELETE")
    },
    onSuccess: () => {
      invalidate()
      toast("Task deleted")
      onClose()
    },
    onError: (error: Error) => toast(error.message),
  })

  const addCommentMutation = useMutation({
    mutationFn: (text: string) => {
      if (!task) throw new Error("No task")
      return postJSON(`/api/tasks/${task.id}/comments`, "POST", { text })
    },
    onSuccess: () => {
      invalidate()
      setCommentText("")
    },
    onError: (error: Error) => toast(error.message),
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => {
      if (!task) throw new Error("No task")
      setDeletingCommentId(commentId)
      return postJSON(`/api/tasks/${task.id}/comments/${commentId}`, "DELETE")
    },
    onSuccess: () => invalidate(),
    onError: (error: Error) => toast(error.message),
    onSettled: () => setDeletingCommentId(null),
  })

  function postComment() {
    const text = commentText.trim()
    if (!text) return
    if (isCreate) {
      setDraftComments((prev) => [...prev, { id: `draft-${Date.now()}`, text }])
      setCommentText("")
    } else {
      addCommentMutation.mutate(text)
    }
  }

  function removeDraftComment(id: string) {
    setDraftComments((prev) => prev.filter((c) => c.id !== id))
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.title.trim()) return
    if (isCreate) createMutation.mutate()
    else updateMutation.mutate()
  }

  function onDeleteClick() {
    if (!deleteArmed) {
      setDeleteArmed(true)
      return
    }
    deleteMutation.mutate()
  }

  function toggleAssignee(userId: string) {
    setForm((prev) => ({
      ...prev,
      assigneeIds: prev.assigneeIds.includes(userId)
        ? prev.assigneeIds.filter((id) => id !== userId)
        : [...prev.assigneeIds, userId],
    }))
  }

  const comments = isCreate ? draftComments.map((c) => ({ id: c.id, authorName: currentUser.name, text: c.text, createdAt: new Date(), authorId: currentUser.id, draft: true as const })) : task!.comments.map((c) => ({ ...c, draft: false as const }))

  const saving = createMutation.isPending || updateMutation.isPending
  const readOnly = !canEdit

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
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
        initial={{ opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.985 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <div className="m-head">
          <div>
            <div className="eyebrow">{task ? displayId(task.number) : "NEW TASK"}</div>
            <h2 id="task-modal-title">{task ? "Task details" : "Create a task"}</h2>
          </div>
          <button type="button" className="x" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>
        <form className="modal-form" onSubmit={onSubmit}>
          <div className="pane">
            <div className="pane-t">Task</div>
            <div className="fld">
              <label htmlFor="fTitle">Task title</label>
              <input
                id="fTitle"
                type="text"
                maxLength={120}
                placeholder="e.g. Prepare weekly market update"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                readOnly={readOnly}
                required
              />
            </div>
            <div className="fld">
              <span className="lbl">Task type</span>
              <div className="seg type">
                {TYPES.map((type) => {
                  const Icon = TASK_TYPE_ICONS[type.id]
                  return (
                    <Fragment key={type.id}>
                      <input
                        type="radio"
                        name="ttype"
                        id={`ttype-${type.id}`}
                        value={type.id}
                        checked={form.type === type.id}
                        disabled={readOnly}
                        onChange={() => setForm({ ...form, type: type.id })}
                      />
                      <label htmlFor={`ttype-${type.id}`}>
                        <Icon size={14} />
                        {type.name}
                      </label>
                    </Fragment>
                  )
                })}
              </div>
            </div>
            <div className="fld">
              <label htmlFor="fDesc">Task description</label>
              <textarea
                id="fDesc"
                placeholder="What needs to be done?"
                value={form.desc}
                onChange={(e) => setForm({ ...form, desc: e.target.value })}
                readOnly={readOnly}
              />
            </div>
            <div className="fld">
              <label htmlFor="fPrompt">
                Task prompt <span className="hint">(shared with the editor)</span>
              </label>
              <textarea
                id="fPrompt"
                placeholder="Paste the prompt or instructions for this task"
                value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                readOnly={readOnly}
              />
            </div>
            <div className="fld">
              <label htmlFor="fRef">
                Task reference <span className="hint">(link or note)</span>
              </label>
              <input
                id="fRef"
                type="text"
                placeholder="Brand kit, brief, inspiration"
                value={form.ref}
                onChange={(e) => setForm({ ...form, ref: e.target.value })}
                readOnly={readOnly}
              />
              <FileUpload
                label="Upload reference"
                accept={SUPPORTED_UPLOAD_TYPES}
                disabled={readOnly}
                onUploaded={(url) => setForm((prev) => ({ ...prev, ref: url }))}
              />
            </div>
            <div className="fld">
              <label htmlFor="fLink">
                Task submission / video link <span className="hint">(set by the team)</span>
              </label>
              <input
                id="fLink"
                type="text"
                inputMode="url"
                placeholder="https://"
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                readOnly={readOnly || !canEditLink}
              />
              {form.link && /^https?:\/\//i.test(form.link) ? (
                <a className="link-btn" href={form.link} target="_blank" rel="noopener noreferrer">
                  Open submission
                </a>
              ) : null}
              {canEditLink ? (
                <FileUpload
                  label="Upload submission"
                  accept={SUPPORTED_UPLOAD_TYPES}
                  disabled={readOnly}
                  onUploaded={(url) => setForm((prev) => ({ ...prev, link: url }))}
                />
              ) : null}
            </div>
          </div>
          <div className="pane">
            <div className="pane-t">Schedule and ownership</div>
            <div className="fld">
              <label htmlFor="fStage">Stage</label>
              <select
                id="fStage"
                value={form.stage}
                disabled={readOnly}
                onChange={(e) => setForm({ ...form, stage: e.target.value as TaskStage })}
              >
                {STAGES.map((stage) => (
                  <option
                    key={stage.id}
                    value={stage.id}
                    disabled={!isOwner && OWNER_ONLY_STAGES.includes(stage.id) && stage.id !== form.stage}
                  >
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="two">
              <div className="fld">
                <label htmlFor="fCreated">
                  Date created <span className="hint">(auto)</span>
                </label>
                <input
                  id="fCreated"
                  type="text"
                  readOnly
                  value={
                    task
                      ? new Date(task.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  }
                />
              </div>
              <div className="fld">
                <label htmlFor="fDue">Due date</label>
                <input
                  id="fDue"
                  type="date"
                  value={form.due}
                  readOnly={readOnly}
                  onChange={(e) => setForm({ ...form, due: e.target.value })}
                />
              </div>
            </div>
            <div className="fld">
              <label htmlFor="fCost">
                Task cost <span className="hint">(USD)</span>
              </label>
              <input
                id="fCost"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={form.cost}
                readOnly={readOnly}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
            </div>
            <div className="fld">
              <span className="lbl">Priority</span>
              <div className="seg">
                {(["high", "medium", "low"] as const).map((priority) => (
                  <Fragment key={priority}>
                    <input
                      type="radio"
                      name="prio"
                      id={`prio-${priority}`}
                      value={priority}
                      checked={form.priority === priority}
                      disabled={readOnly}
                      onChange={() => setForm({ ...form, priority })}
                    />
                    <label htmlFor={`prio-${priority}`} className={priority}>
                      {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </label>
                  </Fragment>
                ))}
              </div>
            </div>
            <div className="fld">
              <span className="lbl">Assignees</span>
              <div className="people">
                {users.map((user) => (
                  <Fragment key={user.id}>
                    <input
                      type="checkbox"
                      id={`pp-${user.id}`}
                      checked={form.assigneeIds.includes(user.id)}
                      disabled={readOnly || !isOwner}
                      onChange={() => toggleAssignee(user.id)}
                    />
                    <label htmlFor={`pp-${user.id}`}>
                      <Avatar
                        name={user.name}
                        bg={user.avatarBg}
                        fg={user.avatarFg}
                        avatarUrl={user.avatarUrl}
                        size={24}
                      />
                      {user.name}
                    </label>
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
          <div className="pane">
            <div className="pane-t">Revision and comments</div>
            <div className="fld">
              <label htmlFor="fRev">
                Revision description <span className="hint">(what needs to change)</span>
              </label>
              <textarea
                id="fRev"
                placeholder="Describe the changes needed. Shows on the card in red."
                value={form.revision}
                readOnly={readOnly || !isOwner}
                onChange={(e) => setForm({ ...form, revision: e.target.value })}
              />
            </div>
            <div className="fld grow">
              <span className="lbl">
                Editor comments <span className="hint">{comments.length > 0 ? `(${comments.length})` : ""}</span>
              </span>
              <div className="cmts">
                {comments.length > 0 ? (
                  comments.map((comment) => {
                    const canDelete =
                      canEdit && (comment.draft || isOwner || comment.authorId === currentUser.id)
                    return (
                      <div key={comment.id} className="cmt">
                        <div className="cmt-h">
                          <b>{comment.authorName}</b>
                          <span>{comment.draft ? "Draft" : fmtTime(comment.createdAt)}</span>
                          {canDelete ? (
                            <button
                              type="button"
                              className="del"
                              disabled={deletingCommentId === comment.id}
                              onClick={() =>
                                comment.draft ? removeDraftComment(comment.id) : deleteCommentMutation.mutate(comment.id)
                              }
                            >
                              {deletingCommentId === comment.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                "Delete"
                              )}
                            </button>
                          ) : null}
                        </div>
                        <p>{comment.text}</p>
                      </div>
                    )
                  })
                ) : (
                  <div className="cmt-empty">No comments yet.</div>
                )}
              </div>
              {canEdit ? (
                <div className="cmt-new">
                  <select id="cmtAuthor" aria-label="Comment as" disabled value={currentUser.name}>
                    <option>{currentUser.name}</option>
                  </select>
                  <textarea
                    id="cmtText"
                    placeholder="Write a comment (Ctrl+Enter to post)"
                    value={commentText}
                    disabled={addCommentMutation.isPending}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault()
                        postComment()
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={addCommentMutation.isPending}
                    onClick={postComment}
                  >
                    {addCommentMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                    Post
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="m-foot">
            {!isCreate && isOwner ? (
              <button
                type="button"
                className={`btn-del ${deleteArmed ? "confirm" : ""}`}
                disabled={deleteMutation.isPending}
                onClick={onDeleteClick}
              >
                {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                {deleteMutation.isPending ? "Deleting" : deleteArmed ? "Click again to delete" : "Delete"}
              </button>
            ) : (
              <span />
            )}
            <div className="right">
              <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              {canEdit ? (
                <button type="submit" className="btn-brand" disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  {isCreate ? (saving ? "Creating" : "Create task") : saving ? "Saving" : "Save changes"}
                </button>
              ) : null}
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
