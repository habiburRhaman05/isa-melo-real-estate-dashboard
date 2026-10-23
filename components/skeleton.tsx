/* Route-level loading placeholders (Next.js loading.tsx boundaries). Each one
   mirrors the real page's layout with the same container classes, so the
   shimmer bars land in the same spots the real content will render into. */

function Bar({ width, height = 14, radius = 8 }: { width: number | string; height?: number; radius?: number }) {
  return <span className="skel" style={{ display: "block", width, height, borderRadius: radius }} />
}

function HeadSkeleton() {
  return (
    <div className="head">
      <div>
        <Bar width={150} height={11} radius={4} />
        <div className="mt-2.5">
          <Bar width={260} height={36} radius={10} />
        </div>
        <div className="mt-2">
          <Bar width={320} height={14} />
        </div>
      </div>
    </div>
  )
}

export function PlannerSkeleton() {
  return (
    <main className="px-6 py-9 pb-12">
      <HeadSkeleton />

      <section className="stats">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="stat">
            <Bar width={60} height={36} radius={8} />
            <div className="mt-2">
              <Bar width={110} height={12} />
            </div>
          </div>
        ))}
      </section>

      <div className="toolbar">
        <div className="pills">
          {Array.from({ length: 4 }).map((_, i) => (
            <Bar key={i} width={i === 0 ? 110 : 80} height={38} radius={999} />
          ))}
        </div>
        <div className="filters">
          <Bar width={320} height={44} radius={12} />
        </div>
      </div>

      <section className="panel">
        <div className="cols">
          {Array.from({ length: 6 }).map((_, col) => (
            <div key={col} className="col">
              <div className="col-head">
                <Bar width={80} height={13} />
              </div>
              <div className="list">
                {Array.from({ length: col % 3 === 0 ? 2 : 1 }).map((_, card) => (
                  <Bar key={card} width="100%" height={176} radius={16} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

export function DirectorySkeleton() {
  return (
    <main className="px-6 py-9 pb-12">
      <HeadSkeleton />
      <div className="tw" style={{ marginTop: 28, padding: 18 }}>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Bar key={i} width="100%" height={52} radius={12} />
          ))}
        </div>
      </div>
    </main>
  )
}

export function SettingsSkeleton() {
  return (
    <main className="px-6 py-9 pb-12">
      <HeadSkeleton />
      <div className="cards">
        {Array.from({ length: 3 }).map((_, i) => (
          <section key={i} className="scard">
            <Bar width={90} height={11} radius={4} />
            <div className="who mt-3">
              <Bar width={52} height={52} radius={999} />
              <div className="flex flex-col gap-2">
                <Bar width={140} height={16} />
                <Bar width={90} height={12} />
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <Bar width="100%" height={44} radius={12} />
              <Bar width="60%" height={44} radius={12} />
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}

export function LeadsSkeleton() {
  return (
    <main className="px-6 py-9 pb-12">
      <HeadSkeleton />
      <section className="stats lead-stats">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="stat">
            <Bar width={50} height={36} radius={8} />
            <div className="mt-2">
              <Bar width={100} height={12} />
            </div>
          </div>
        ))}
      </section>
      <div className="toolbar">
        <Bar width={260} height={44} radius={12} />
        <Bar width={220} height={44} radius={12} />
      </div>
      <div className="tw" style={{ marginTop: 18, padding: 18 }}>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Bar key={i} width="100%" height={48} radius={12} />
          ))}
        </div>
      </div>
    </main>
  )
}
