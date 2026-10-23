import { money, plannerStats, type TaskLike } from "@/lib/planner"

const VALUE_COLORS = ["#5a2d9c", "#8a2333", "#8a5a0f", "#5a2d9c"]

export function StatsStrip({
  tasks,
  role,
}: {
  tasks: TaskLike[]
  role: "member" | "admin" | "super_admin"
}) {
  const stats = plannerStats(tasks, role)

  const items = [
    { value: String(stats.active), label: "Active tasks" },
    { value: money(stats.total), label: "Task cost in progress" },
    { value: String(stats.review), label: stats.reviewLabel },
    { value: String(stats.soon), label: "Due in the next 7 days" },
  ]

  return (
    <section className="stats">
      {items.map((item, index) => (
        <div key={item.label} className="stat">
          <b style={{ color: VALUE_COLORS[index] }}>{item.value}</b>
          <span>{item.label}</span>
        </div>
      ))}
    </section>
  )
}
