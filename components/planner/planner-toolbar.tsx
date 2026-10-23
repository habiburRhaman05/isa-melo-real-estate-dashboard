"use client"

import { Search } from "lucide-react"

import type { Priority } from "@/lib/db/enums"
import { hasAnyFilter, type PlannerFilter, TYPES } from "@/lib/planner"

import { DateRangePopover } from "./date-range-popover"

const PRIORITY_PILLS: { id: Priority | "all"; label: string }[] = [
  { id: "all", label: "All priorities" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
]

export function PlannerToolbar({
  filter,
  onChange,
}: {
  filter: PlannerFilter
  onChange: (next: PlannerFilter) => void
}) {
  return (
    <div className="toolbar">
      <div className="pills">
        {PRIORITY_PILLS.map((pill) => (
          <button
            key={pill.id}
            type="button"
            className={`pill-btn ${filter.priority === pill.id ? "on" : ""}`}
            onClick={() => onChange({ ...filter, priority: pill.id })}
          >
            {pill.label}
          </button>
        ))}
        {hasAnyFilter(filter) ? (
          <button
            type="button"
            className="link-btn"
            onClick={() =>
              onChange({
                priority: "all",
                type: "all",
                due: { from: "", to: "" },
                created: { from: "", to: "" },
                q: "",
              })
            }
          >
            Clear filters
          </button>
        ) : null}
      </div>
      <div className="filters">
        <select
          className={`f-select ${filter.type !== "all" ? "active" : ""}`}
          aria-label="Filter by task type"
          value={filter.type}
          onChange={(event) =>
            onChange({ ...filter, type: event.target.value as PlannerFilter["type"] })
          }
        >
          <option value="all">All types</option>
          {TYPES.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
        <DateRangePopover
          label="Due date"
          value={filter.due}
          onApply={(due) => onChange({ ...filter, due })}
        />
        <DateRangePopover
          label="Created date"
          value={filter.created}
          onApply={(created) => onChange({ ...filter, created })}
        />
        <label className="search">
          <Search size={16} />
          <input
            type="search"
            placeholder="Search tasks"
            autoComplete="off"
            value={filter.q}
            onChange={(event) => onChange({ ...filter, q: event.target.value })}
          />
        </label>
      </div>
    </div>
  )
}

