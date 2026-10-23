import {
  commentCreateSchema,
  leadCreateSchema,
  leadUpdateSchema,
  loginSchema,
  passwordChangeSchema,
  profileUpdateSchema,
  settingsUpdateSchema,
  taskCreateSchema,
  taskUpdateSchema,
  userCreateSchema,
  userUpdateSchema,
} from "./validators"

describe("loginSchema", () => {
  it("requires a valid email and a non-empty password", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false)
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false)
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true)
  })

  it("trims and lowercases nothing unexpected, but trims whitespace from email", () => {
    const parsed = loginSchema.safeParse({ email: "  a@b.com  ", password: "x" })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.email).toBe("a@b.com")
  })
})

describe("taskCreateSchema", () => {
  it("requires a title and applies defaults for everything else", () => {
    const parsed = taskCreateSchema.safeParse({ title: "Do the thing" })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).toMatchObject({
        type: "post",
        desc: "",
        prompt: "",
        ref: "",
        link: "",
        due: null,
        cost: 0,
        priority: "medium",
        stage: "new",
        revision: null,
        assigneeIds: [],
        initialComments: [],
      })
    }
  })

  it("rejects an empty title", () => {
    expect(taskCreateSchema.safeParse({ title: "" }).success).toBe(false)
    expect(taskCreateSchema.safeParse({ title: "   " }).success).toBe(false)
  })

  it("rejects a title over 120 characters", () => {
    expect(taskCreateSchema.safeParse({ title: "a".repeat(121) }).success).toBe(false)
    expect(taskCreateSchema.safeParse({ title: "a".repeat(120) }).success).toBe(true)
  })

  it("rejects negative cost", () => {
    expect(taskCreateSchema.safeParse({ title: "t", cost: -1 }).success).toBe(false)
  })

  it("accepts a well-formed due date and rejects malformed or impossible ones", () => {
    expect(taskCreateSchema.safeParse({ title: "t", due: "2026-03-15" }).success).toBe(true)
    expect(taskCreateSchema.safeParse({ title: "t", due: null }).success).toBe(true)
    expect(taskCreateSchema.safeParse({ title: "t", due: "2026-03-45" }).success).toBe(false)
    expect(taskCreateSchema.safeParse({ title: "t", due: "2026-02-30" }).success).toBe(false)
    expect(taskCreateSchema.safeParse({ title: "t", due: "03/15/2026" }).success).toBe(false)
  })

  it("accepts Feb 29 on a leap year and rejects it otherwise", () => {
    expect(taskCreateSchema.safeParse({ title: "t", due: "2028-02-29" }).success).toBe(true)
    expect(taskCreateSchema.safeParse({ title: "t", due: "2026-02-29" }).success).toBe(false)
  })

  it("rejects an invalid task type / priority / stage", () => {
    expect(taskCreateSchema.safeParse({ title: "t", type: "tweet" }).success).toBe(false)
    expect(taskCreateSchema.safeParse({ title: "t", priority: "urgent" }).success).toBe(false)
    expect(taskCreateSchema.safeParse({ title: "t", stage: "archived" }).success).toBe(false)
  })

  it("rejects malformed assignee ids", () => {
    expect(taskCreateSchema.safeParse({ title: "t", assigneeIds: ["not-a-uuid"] }).success).toBe(false)
  })
})

describe("taskUpdateSchema", () => {
  it("accepts a fully empty partial update", () => {
    expect(taskUpdateSchema.safeParse({}).success).toBe(true)
  })

  it("rejects an empty title when provided", () => {
    expect(taskUpdateSchema.safeParse({ title: "" }).success).toBe(false)
  })

  it("allows clearing revision with null but distinguishes from omission", () => {
    const cleared = taskUpdateSchema.safeParse({ revision: null })
    expect(cleared.success).toBe(true)
    if (cleared.success) expect(cleared.data.revision).toBeNull()

    const omitted = taskUpdateSchema.safeParse({})
    expect(omitted.success).toBe(true)
    if (omitted.success) expect(omitted.data.revision).toBeUndefined()
  })
})

describe("lead stage validation", () => {
  it("accepts GHL stage ids and defaults the stage to the pipeline's first one", () => {
    const parsed = leadCreateSchema.safeParse({ firstName: "A", stage: "stage-abc123" })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.stage).toBe("stage-abc123")

    const omitted = leadCreateSchema.safeParse({ firstName: "A" })
    expect(omitted.success).toBe(true)
    if (omitted.success) expect(omitted.data.stage).toBeUndefined()
  })

  it("rejects an empty stage id on create and update", () => {
    expect(leadCreateSchema.safeParse({ firstName: "A", stage: "  " }).success).toBe(false)
    expect(leadUpdateSchema.safeParse({ stage: "" }).success).toBe(false)
  })
})

describe("commentCreateSchema", () => {
  it("rejects empty or whitespace-only text", () => {
    expect(commentCreateSchema.safeParse({ text: "" }).success).toBe(false)
    expect(commentCreateSchema.safeParse({ text: "   " }).success).toBe(false)
  })

  it("rejects text over 4000 characters", () => {
    expect(commentCreateSchema.safeParse({ text: "a".repeat(4001) }).success).toBe(false)
    expect(commentCreateSchema.safeParse({ text: "a".repeat(4000) }).success).toBe(true)
  })
})

describe("userCreateSchema", () => {
  it("requires an 8+ character password and lowercases the email", () => {
    const tooShort = userCreateSchema.safeParse({ name: "A", email: "A@B.com", password: "short" })
    expect(tooShort.success).toBe(false)

    const ok = userCreateSchema.safeParse({ name: "A", email: "A@B.COM", password: "longenough" })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.email).toBe("a@b.com")
  })

  it("defaults role to member and avatarUrl to null", () => {
    const parsed = userCreateSchema.safeParse({ name: "A", email: "a@b.com", password: "longenough" })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.role).toBe("member")
      expect(parsed.data.avatarUrl).toBeNull()
    }
  })

  it("rejects a malformed hex colour", () => {
    expect(
      userCreateSchema.safeParse({
        name: "A",
        email: "a@b.com",
        password: "longenough",
        avatarBg: "purple",
      }).success,
    ).toBe(false)
  })
})

describe("userUpdateSchema avatarUrl", () => {
  it("accepts a valid url, null, or omission; rejects a non-url string", () => {
    expect(userUpdateSchema.safeParse({ avatarUrl: "https://cdn.example.com/a.png" }).success).toBe(true)
    expect(userUpdateSchema.safeParse({ avatarUrl: null }).success).toBe(true)
    expect(userUpdateSchema.safeParse({}).success).toBe(true)
    expect(userUpdateSchema.safeParse({ avatarUrl: "not-a-url" }).success).toBe(false)
  })
})

describe("profileUpdateSchema", () => {
  it("every field is optional", () => {
    expect(profileUpdateSchema.safeParse({}).success).toBe(true)
  })

  it("validates avatarUrl the same way as userUpdateSchema", () => {
    expect(profileUpdateSchema.safeParse({ avatarUrl: "ftp://bad" }).success).toBe(true) // ftp is still a valid URL per zod's .url()
    expect(profileUpdateSchema.safeParse({ avatarUrl: "no-scheme" }).success).toBe(false)
  })
})

describe("passwordChangeSchema", () => {
  it("rejects when the new password equals the current password", () => {
    const parsed = passwordChangeSchema.safeParse({
      currentPassword: "samepassword",
      newPassword: "samepassword",
    })
    expect(parsed.success).toBe(false)
  })

  it("accepts a different, long-enough new password", () => {
    const parsed = passwordChangeSchema.safeParse({
      currentPassword: "oldpassword",
      newPassword: "newpassword123",
    })
    expect(parsed.success).toBe(true)
  })

  it("rejects a new password under 8 characters", () => {
    const parsed = passwordChangeSchema.safeParse({ currentPassword: "oldpassword", newPassword: "short" })
    expect(parsed.success).toBe(false)
  })
})

describe("settingsUpdateSchema", () => {
  it("coerces numeric strings and rejects negative rates", () => {
    expect(settingsUpdateSchema.safeParse({ creditRate: "7.5" }).success).toBe(true)
    expect(settingsUpdateSchema.safeParse({ creditRate: -1 }).success).toBe(false)
    expect(settingsUpdateSchema.safeParse({}).success).toBe(true)
  })
})
