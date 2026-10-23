"use client"

import { ChevronDown, ChevronsUpDown, ChevronUp, Eye } from "lucide-react"
import { useState } from "react"

import { Avatar } from "@/components/avatar"
import type { LeadRecord } from "@/lib/db/queries"
import { leadAvatarColors, leadMoney, type LeadPipelineStage, relDay, stageInfo } from "@/lib/leads"

type SortKey = "firstName" | "lastName" | "business" | "address" | "country" | "professional" | "value" | "stage" | "createdAt"

const COLUMNS: { key: SortKey | null; label: string }[] = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: null, label: "Phone" },
  { key: "business", label: "Business info" },
  { key: "address", label: "Address" },
  { key: "country", label: "Country" },
  { key: "professional", label: "Professional" },
  { key: "value", label: "Value" },
  { key: "stage", label: "Stage" },
  { key: "createdAt", label: "Created" },
  { key: null, label: "View" },
]

function SortIcon({ active, dir }: { active: boolean; dir: 1 | -1 }) {
  if (!active) return <ChevronsUpDown size={12} />
  return dir === 1 ? <ChevronUp size={12} /> : <ChevronDown size={12} />
}

export function LeadsTable({
  leads,
  stages,
  onOpen,
}: {
  leads: LeadRecord[]
  stages: LeadPipelineStage[]
  onOpen: (id: string) => void
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "createdAt", dir: -1 })

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 1 ? -1 : 1 } : { key, dir: -1 }))
  }

  const sorted = [...leads].sort((a, b) => {
    let cmp = 0
    if (sort.key === "value") {
      cmp = (Number(a.value) || 0) - (Number(b.value) || 0)
    } else if (sort.key === "createdAt") {
      cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    } else if (sort.key === "stage") {
      cmp = stageInfo(a.stage, stages).name.localeCompare(stageInfo(b.stage, stages).name)
    } else {
      cmp = String(a[sort.key] ?? "").localeCompare(String(b[sort.key] ?? ""))
    }
    return cmp * sort.dir
  })

  return (
    <div className="tw" style={{ marginTop: 18 }}>
      {sorted.length > 0 ? (
        <table className="lt">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.label}
                  data-s={col.key ?? undefined}
                  className={col.key && sort.key === col.key ? "on" : undefined}
                  style={col.key ? { cursor: "pointer" } : undefined}
                  onClick={col.key ? () => toggleSort(col.key!) : undefined}
                >
                  {col.label}
                  {col.key ? <SortIcon active={sort.key === col.key} dir={sort.dir} /> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((lead) => {
              const stage = stageInfo(lead.stage, stages)
              const avatar = leadAvatarColors(lead.number)
              return (
                <tr key={lead.id} style={{ cursor: "pointer" }} onClick={() => onOpen(lead.id)}>
                  <td>
                    <span className="nm">
                      <Avatar name={lead.firstName} bg={avatar.bg} fg={avatar.fg} size={34} />
                      {lead.firstName}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{lead.lastName}</td>
                  <td>{lead.phone}</td>
                  <td>
                    <b>{lead.business}</b>
                    <small>{lead.info}</small>
                  </td>
                  <td>{lead.address}</td>
                  <td>{lead.country}</td>
                  <td>
                    <span className="pp">{lead.professional}</span>
                  </td>
                  <td style={{ fontWeight: 600, color: "hsl(var(--success))" }}>{leadMoney(lead.value)}</td>
                  <td>
                    <span className="sp" style={{ background: stage.bg, color: stage.fg }}>
                      <i style={{ background: stage.color }} />
                      {stage.name}
                    </span>
                  </td>
                  <td>
                    {new Date(lead.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    <small>{relDay(lead.createdAt.toString().slice(0, 10))}</small>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="vb"
                      onClick={(event) => {
                        event.stopPropagation()
                        onOpen(lead.id)
                      }}
                    >
                      <Eye size={14} />
                      View
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        <div className="lempty">No leads match these filters.</div>
      )}
    </div>
  )
}
