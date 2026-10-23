"use client"

import { useRef, useState } from "react"

import { OWNER_ONLY_STAGES, type TaskStage } from "@/lib/db/enums"
import type { PlannerTask } from "@/lib/db/queries"
import { STAGES } from "@/lib/planner"

import { TaskCard } from "./task-card"

export function KanbanBoard({
  tasks,
  role,
  canDragTask,
  movingId,
  onOpen,
  onMove,
}: {
  tasks: PlannerTask[]
  role: "member" | "admin" | "super_admin"
  canDragTask: (task: PlannerTask) => boolean
  movingId?: string | null
  onOpen: (id: string) => void
  onMove: (taskId: string, stage: TaskStage) => void
}) {
  /* dragId drives the visuals; dragRef is what the dragover/drop handlers read.
     A quick flick fires dragover before React has re-rendered with the new
     state, and a dragover that doesn't preventDefault silently kills the drop. */
  const dragRef = useRef<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<TaskStage | null>(null)

  function startDrag(id: string) {
    dragRef.current = id
    setDragId(id)
  }

  function clearDrag() {
    dragRef.current = null
    setDragId(null)
    setOverStage(null)
  }

  return (
    <section className="panel">
      <div className="cols">
        {STAGES.map((stage) => {
          const stageTasks = tasks.filter((task) => task.stage === stage.id)
          const locked = role === "member" && OWNER_ONLY_STAGES.includes(stage.id)

          return (
            <div key={stage.id} className={`col ${locked ? "locked" : ""}`} data-stage={stage.id}>
              <div className="col-head">
                <span className="dot" style={{ background: stage.color }} />
                <span>{stage.name}</span>
                {stage.badge ? <span className="badge">{stage.badge}</span> : null}
                <span className="count">{stageTasks.length}</span>
              </div>
              <div
                className={`list ${overStage === stage.id ? "over" : ""}`.trim()}
                data-stage={stage.id}
                onDragOver={(event) => {
                  if (!dragRef.current) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = "move"
                  setOverStage((current) => (current === stage.id ? current : stage.id))
                }}
                onDragLeave={(event) => {
                  /* ignore moves between children of the same list */
                  if (event.currentTarget.contains(event.relatedTarget as Node)) return
                  setOverStage((current) => (current === stage.id ? null : current))
                }}
                onDrop={(event) => {
                  /* dataTransfer is the fallback for browsers that drop the
                     ref between frames; the card always writes the id there */
                  const id = dragRef.current || event.dataTransfer.getData("text/plain")
                  if (!id) return
                  event.preventDefault()
                  clearDrag()
                  onMove(id, stage.id)
                }}
              >
                {stageTasks.length > 0 ? (
                  stageTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onOpen={onOpen}
                      draggable={canDragTask(task) && task.id !== movingId}
                      dragging={dragId === task.id}
                      busy={task.id === movingId}
                      onDragStart={startDrag}
                      onDragEnd={clearDrag}
                    />
                  ))
                ) : (
                  <div className="empty">No tasks here</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
