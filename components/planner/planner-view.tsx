"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence } from "framer-motion"
import { Plus } from "lucide-react"
import { useState } from "react"

import { useToast } from "@/components/toast"
import type { SessionUser } from "@/lib/auth"
import type { TaskStage } from "@/lib/db/enums"
import type { PlannerTask, TeamUser } from "@/lib/db/queries"
import { canCreateTask, canMoveToStage, isOwnerRole } from "@/lib/permissions"
import { EMPTY_FILTER, filterTasks, hasAnyFilter, type PlannerFilter, STAGES } from "@/lib/planner"

import { KanbanBoard } from "./kanban-board"
import { PlannerToolbar } from "./planner-toolbar"
import { StatsStrip } from "./stats-strip"
import { TaskModal } from "./task-modal"

async function fetchTasks(): Promise<PlannerTask[]> {
  const res = await fetch("/api/tasks")
  if (!res.ok) throw new Error("Failed to load tasks")
  const data = (await res.json()) as { tasks: PlannerTask[] }
  return data.tasks
}

function stageName(id: TaskStage) {
  return STAGES.find((s) => s.id === id)?.name ?? id
}

export function PlannerView({
  user,
  initialTasks,
  initialUsers,
}: {
  user: SessionUser
  initialTasks: PlannerTask[]
  initialUsers: TeamUser[]
}) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<PlannerFilter>(EMPTY_FILTER)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const { data: tasks = [] } = useQuery({
    queryKey: ["planner", "tasks"],
    queryFn: fetchTasks,
    initialData: initialTasks,
  })

  const moveMutation = useMutation({
    mutationFn: async ({ taskId, stage }: { taskId: string; stage: TaskStage }) => {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string; task?: PlannerTask } | null
      if (!res.ok) throw new Error(data?.error ?? "Failed to move task")
      return data?.task
    },
    /* Move the card into its new column immediately so the board responds to
       the drop instead of sitting still for the round trip, and keep the card's
       busy spinner running until the server confirms. */
    onMutate: async ({ taskId, stage }) => {
      await queryClient.cancelQueries({ queryKey: ["planner", "tasks"] })
      const previous = queryClient.getQueryData<PlannerTask[]>(["planner", "tasks"])
      queryClient.setQueryData<PlannerTask[]>(["planner", "tasks"], (current) =>
        current?.map((task) => (task.id === taskId ? { ...task, stage } : task)) ?? current,
      )
      return { previous }
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(["planner", "tasks"], context.previous)
      toast(error.message)
    },
    onSuccess: (task, variables) => {
      if (task) toast(`T-${task.number} moved to ${stageName(variables.stage)}`)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["planner", "tasks"] })
    },
  })

  const visible = filterTasks(tasks, filter)
  const selected = tasks.find((task) => task.id === selectedId) ?? null
  const movingId = moveMutation.isPending ? moveMutation.variables?.taskId ?? null : null

  function onMove(taskId: string, stage: TaskStage) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.stage === stage) return

    if (!canMoveToStage(user, task, stage)) {
      toast(
        isOwnerRole(user)
          ? "You can't move that task"
          : `Only the owner can move tasks to ${stageName(stage)}`,
      )
      return
    }

    moveMutation.mutate({ taskId, stage })
  }

  return (
    <main className="px-6 py-9 pb-12">
      <div className="head">
        <div>
          <div className="eyebrow">Social media board</div>
          <h1>Content pipeline</h1>
          <p className="text-muted-foreground">
            Every post, from brief to published, moving through one clear flow.
          </p>
        </div>
        {canCreateTask(user) ? (
          <div className="head-right">
            <button type="button" className="btn-brand" onClick={() => setCreating(true)}>
              <Plus size={16} strokeWidth={2.4} />
              New task
            </button>
          </div>
        ) : null}
      </div>

      <StatsStrip tasks={tasks} role={user.role} />

      <PlannerToolbar filter={filter} onChange={setFilter} />

      <KanbanBoard
        tasks={visible}
        role={user.role}
        canDragTask={(task) => isOwnerRole(user) || task.assignees.some((a) => a.userId === user.id)}
        movingId={movingId}
        onOpen={setSelectedId}
        onMove={onMove}
      />

      <AnimatePresence>
        {creating ? (
          <TaskModal
            key="create"
            task={null}
            users={initialUsers}
            currentUser={user}
            onClose={() => setCreating(false)}
            onCreated={() => {
              /* active filters can hide a brand-new task entirely, which reads
                 as "all my tasks disappeared" - clear them so it's visible. */
              if (hasAnyFilter(filter)) {
                setFilter(EMPTY_FILTER)
                toast("Filters cleared so your new task is visible")
              }
            }}
          />
        ) : selected ? (
          <TaskModal
            key={selected.id}
            task={selected}
            users={initialUsers}
            currentUser={user}
            onClose={() => setSelectedId(null)}
          />
        ) : null}
      </AnimatePresence>
    </main>
  )
}
