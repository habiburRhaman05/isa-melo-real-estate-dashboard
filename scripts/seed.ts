import { sql } from "drizzle-orm"

import { loadEnvFile } from "../lib/load-env"

loadEnvFile()

const SUPERADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL ?? "superadmin@isamelo.com"
const SUPERADMIN_PASSWORD = process.env.SEED_SUPERADMIN_PASSWORD ?? "IsaMelo@2026"
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@isamelo.com"
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin@2026"
const MEMBER_PASSWORD = process.env.SEED_MEMBER_PASSWORD ?? "Team@2026"

function dayOffset(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

async function main() {
  /* imported after loadEnvFile: lib/db reads DATABASE_URL at import time */
  const { db } = await import("../lib/db")
  const { comments, taskAssignees, tasks, users } = await import("../lib/db/schema")
  const { hashPassword } = await import("../lib/password")
  const existing = await db.select({ id: users.id }).from(users).limit(1)
  if (existing.length > 0) {
    console.log("Users already exist, skipping seed.")
    return
  }

  const password = await hashPassword(MEMBER_PASSWORD)

  const seedUsers = [
    { email: SUPERADMIN_EMAIL, name: "Isa Melo", role: "super_admin", passwordHash: await hashPassword(SUPERADMIN_PASSWORD), avatarBg: "#e6dcf7", avatarFg: "#5a2d9c" },
    { email: ADMIN_EMAIL, name: "Ayesha Siddiqui", role: "admin", passwordHash: await hashPassword(ADMIN_PASSWORD), avatarBg: "#f6eac0", avatarFg: "#8a6212" },
    { email: "rakib@isamelo.com", name: "Rakib", role: "member", passwordHash: password, avatarBg: "#f6eac0", avatarFg: "#8a6212" },
    { email: "sajib@isamelo.com", name: "Sajib", role: "member", passwordHash: password, avatarBg: "#d5eadf", avatarFg: "#25704f" },
  ] as const

  await db.insert(users).values([...seedUsers])

  const byEmail = new Map(
    (await db.select().from(users)).map((u) => [u.email, u]),
  )
  const id = (email: string) => byEmail.get(email)!.id

  const seedTasks = [
    {
      number: 101,
      title: "Prepare weekly market update",
      desc: "Draft a concise local market update with key insights and one clear call to action for buyers and sellers.",
      ref: "Weekly market report (Google Doc)",
      created: -3,
      due: 3,
      link: "https://drive.google.com/file/d/market-update",
      cost: "40",
      prompt: "Keep the tone friendly and local. End with one clear call to action.",
      priority: "medium",
      assignees: [id("superadmin@isamelo.com")],
      stage: "new",
      type: "post",
    },
    {
      number: 102,
      title: "Edit property walkthrough reel",
      desc: "Trim the walkthrough footage, add captions, and prepare the final cut for Instagram.",
      ref: "Brand kit + raw footage folder",
      created: -2,
      due: 1,
      link: "https://frame.io/review/walkthrough-v2",
      cost: "75",
      prompt: "",
      priority: "high",
      assignees: [id("rakib@isamelo.com")],
      stage: "working",
      type: "reel",
    },
    {
      number: 103,
      title: "Review open house announcement",
      desc: "Check the listing details, final visual, and copy before the announcement goes live.",
      ref: "Listing sheet MLS 4821",
      created: -1,
      due: 0,
      link: "",
      cost: "25",
      prompt: "",
      priority: "low",
      assignees: [id("sajib@isamelo.com"), id("superadmin@isamelo.com")],
      stage: "review",
      type: "image",
    },
    {
      number: 104,
      title: "Design open house flyer",
      desc: "Update the open house flyer with the new pricing block and refresh the photo selection.",
      ref: "Flyer template v3 (Figma)",
      created: -4,
      due: 2,
      link: "https://figma.com/file/flyer-v3",
      cost: "30",
      prompt: "Use the updated pricing block from the listing sheet.",
      priority: "high",
      assignees: [id("rakib@isamelo.com"), id("sajib@isamelo.com")],
      stage: "revision",
      type: "image",
      revision: "Please use the updated pricing block from the listing sheet.",
    },
    {
      number: 105,
      title: "Weekly market update reel",
      desc: "Short reel summarizing this week's local market numbers with captions.",
      ref: "Market report week 42",
      created: -6,
      due: -1,
      link: "https://drive.google.com/file/d/week42-reel",
      cost: "60",
      prompt: "",
      priority: "medium",
      assignees: [id("superadmin@isamelo.com")],
      stage: "approved",
      type: "reel",
    },
    {
      number: 106,
      title: "Listing spotlight carousel",
      desc: "Carousel highlighting the Dhanmondi listing with photo tour and price.",
      ref: "Listing sheet MLS 4812",
      created: -8,
      due: -3,
      link: "https://instagram.com/p/spotlight",
      cost: "45",
      prompt: "",
      priority: "low",
      assignees: [id("sajib@isamelo.com")],
      stage: "posted",
      type: "post",
    },
  ] as const

  const createdBy = id("superadmin@isamelo.com")

  for (const t of seedTasks) {
    const [task] = await db
      .insert(tasks)
      .values({
        number: t.number,
        title: t.title,
        desc: t.desc,
        prompt: t.prompt,
        ref: t.ref,
        link: t.link,
        type: t.type,
        priority: t.priority,
        stage: t.stage,
        cost: t.cost,
        due: dayOffset(t.due),
        revision: t.stage === "revision" ? t.revision : null,
        createdBy,
        createdAt: new Date(Date.now() + t.created * 86_400_000),
      })
      .returning()

    if (task) {
      await db.insert(taskAssignees).values(
        t.assignees.map((userId) => ({ taskId: task.id, userId })),
      )
    }
  }

  const t103 = await db.query.tasks.findFirst({ where: sql`${tasks.number} = 103` })
  if (t103) {
    await db.insert(comments).values({
      taskId: t103.id,
      authorId: id("sajib@isamelo.com"),
      authorName: "Sajib",
      text: "Please double check the open house time before approving.",
    })
  }

  /* keep the serial sequence ahead of the explicit display numbers */
  await db.execute(
    sql`SELECT setval(pg_get_serial_sequence('tasks', 'number'), COALESCE((SELECT MAX(number) FROM tasks), 1))`,
  )

  console.log("Seed complete.")
  console.log(`  Super admin: ${SUPERADMIN_EMAIL} / ${SUPERADMIN_PASSWORD}`)
  console.log(`  Admin:       ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
  console.log(`  Members:     rakib@isamelo.com, sajib@isamelo.com / ${MEMBER_PASSWORD}`)

  process.exit(0)
}

main().catch((error) => {
  console.error("Seed failed:", error)
  process.exit(1)
})
