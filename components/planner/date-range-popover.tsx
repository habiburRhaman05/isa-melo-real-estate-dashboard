"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"

import {
  type DateRange,
  fmtDate,
  fmtDateY,
  parseDate,
  presetRange,
  ymd,
} from "@/lib/planner"

import { CalendarDays } from "./icons"

const PRESETS = [
  { name: "today", label: "Today" },
  { name: "next7", label: "Next 7 days" },
  { name: "last7", label: "Last 7 days" },
  { name: "month", label: "This month" },
  { name: "nextmonth", label: "Next month" },
] as const

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function rangeLabel(label: string, r: DateRange) {
  if (!r.from) return label
  const to = r.to || r.from
  return `${label}: ${r.from === to ? fmtDate(r.from) : `${fmtDate(r.from)} to ${fmtDate(to)}`}`
}

export function DateRangePopover({
  label,
  value,
  onApply,
}: {
  label: string
  value: DateRange
  onApply: (range: DateRange) => void
}) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(value.from)
  const [to, setTo] = useState(value.to)
  const [month, setMonth] = useState(() => startOfMonth(value.from))
  const rootRef = useRef<HTMLDivElement>(null)

  function startOfMonth(dateStr: string) {
    const base = dateStr ? parseDate(dateStr) : new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  }

  useEffect(() => {
    if (open) {
      setFrom(value.from)
      setTo(value.to)
      setMonth(startOfMonth(value.from))
    }
  }, [open, value.from, value.to])

  useEffect(() => {
    if (!open) return
    function onMouseDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onMouseDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onMouseDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  function clickDay(day: string) {
    if (!from || (from && to)) {
      setFrom(day)
      setTo("")
    } else if (day < from) {
      setTo(from)
      setFrom(day)
    } else {
      setTo(day)
    }
  }

  function applyPreset(name: string) {
    const range = presetRange(name)
    setFrom(range.from)
    setTo(range.to)
    setMonth(startOfMonth(range.from))
  }

  const today = ymd(new Date())
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstWeekday = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const hi = to || from

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={`f-btn ${value.from ? "active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <CalendarDays size={16} />
        <span>{rangeLabel(label, value)}</span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            className="cal top-[calc(100%+8px)] right-0"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <div className="presets">
              <b>QUICK RANGE</b>
              {PRESETS.map((preset) => (
                <button key={preset.name} type="button" onClick={() => applyPreset(preset.name)}>
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="cal-main">
              <div className="cal-nav">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}
                >
                  &#8249;
                </button>
                <strong>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}
                >
                  &#8250;
                </button>
              </div>
              <div className="dow">
                {DOW.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="days">
                {Array.from({ length: firstWeekday }, (_, i) => (
                  <button key={`blank-${i}`} type="button" className="blank" tabIndex={-1} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1
                  const date = ymd(new Date(year, monthIndex, day))
                  const cls = [
                    date === today ? "today" : "",
                    from && date === from ? "s" : "",
                    from && hi && date === hi ? "e" : "",
                    from && hi && date > from && date < hi ? "in" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")
                  return (
                    <button key={day} type="button" className={cls} onClick={() => clickDay(date)}>
                      {day}
                    </button>
                  )
                })}
              </div>
              <div className="cal-foot">
                <span className="sel">
                  {from
                    ? to && to !== from
                      ? `${fmtDateY(from)} to ${fmtDateY(to)}`
                      : fmtDateY(from)
                    : "Pick a start and end date"}
                </span>
                <div className="btns">
                  <button type="button" onClick={() => onApply({ from: "", to: "" })}>
                    Clear
                  </button>
                  <button
                    type="button"
                    className="apply"
                    onClick={() => {
                      onApply(from ? { from, to: to || from } : { from: "", to: "" })
                      setOpen(false)
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
