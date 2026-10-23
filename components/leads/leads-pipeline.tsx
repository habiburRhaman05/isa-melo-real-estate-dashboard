"use client"

import { useRef, useState } from "react"

import type { LeadStage } from "@/lib/db/enums"
import type { LeadRecord } from "@/lib/db/queries"
import { isOpenStage, leadMoney, type LeadPipelineStage } from "@/lib/leads"

import { LeadCard } from "./lead-card"

export function LeadsPipeline({
  leads,
  stages,
  canDrag,
  movingId,
  onOpen,
  onMove,
}: {
  leads: LeadRecord[]
  stages: LeadPipelineStage[]
  canDrag: boolean
  movingId?: string | null
  onOpen: (id: string) => void
  onMove: (leadId: string, stage: LeadStage) => void
}) {
  /* same dragRef-vs-state split as the planner's kanban board: a fast flick
     can fire dragover before React re-renders with the new dragId state. */
  const dragRef = useRef<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<LeadStage | null>(null)

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
      <div className="cols lead-cols">
        {stages.map((stage) => {
          const stageLeads = leads.filter((lead) => lead.stage === stage.id)
          const stageValue = isOpenStage(stage.id, stages)
            ? stageLeads.reduce((sum, lead) => sum + (Number(lead.value) || 0), 0)
            : 0

          return (
            <div key={stage.id} className="col" data-stage={stage.id}>
              <div className="col-head">
                <span className="dot" style={{ background: stage.color }} />
                <span>{stage.name}</span>
                <span className="count">{stageLeads.length}</span>
                {stageValue > 0 ? <span className="ct">{leadMoney(stageValue)}</span> : null}
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
                  if (event.currentTarget.contains(event.relatedTarget as Node)) return
                  setOverStage((current) => (current === stage.id ? null : current))
                }}
                onDrop={(event) => {
                  const id = dragRef.current || event.dataTransfer.getData("text/plain")
                  if (!id) return
                  event.preventDefault()
                  clearDrag()
                  onMove(id, stage.id)
                }}
              >
                {stageLeads.length > 0 ? (
                  stageLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      stages={stages}
                      onOpen={onOpen}
                      draggable={canDrag && lead.id !== movingId}
                      dragging={dragId === lead.id}
                      busy={lead.id === movingId}
                      onDragStart={startDrag}
                      onDragEnd={clearDrag}
                    />
                  ))
                ) : (
                  <div className="empty">No leads here</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
