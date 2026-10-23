# Isa Melo Real Estate Dashboard - Feature List and Role Permissions

UI source of truth: `prototypes/index.html` (exact design must be replicated in Next.js components).

## 1. Roles

| Role | Who | Summary |
|---|---|---|
| Team member | Content/design/video team | Works on tasks assigned to them; sees the board; cannot touch other members' tasks |
| Admin | Agency manager (e.g. Isa Melo) | Full control of tasks and leads, manages team members |
| Super admin | Account owner | Everything the admin can do, plus manage admins and system settings |

## 2. Permission matrix

| Feature | Team member | Admin | Super admin |
|---|---|---|---|
| Login / logout | yes | yes | yes |
| View kanban board and filters | yes | yes | yes |
| Create task | no (confirm) | yes | yes |
| Edit task details (title, desc, prompt, ref, link, cost, priority, type, due) | only assigned tasks | any task | any task |
| Move task stage (drag and drop / select) | only assigned tasks, not to Approved/Posted | any task, any stage | any task, any stage |
| Set revision request on task | no (confirm) | yes | yes |
| Assign members to task (multi-assignee) | no | yes | yes |
| Comments on tasks | assigned tasks only | any task | any task |
| Delete comment | own comments | any | any |
| Delete task | no | yes | yes |
| View leads | assigned leads only (confirm) | all leads | all leads |
| Add lead (manual) | no | yes | yes |
| Edit lead details | no (confirm) | yes | yes |
| Change lead stage | assigned leads (confirm) | yes | yes |
| Log activity on lead (note/call/email/meeting/message) | assigned leads | yes | yes |
| Set lead follow-up date and opportunity value | assigned leads (confirm) | yes | yes |
| Assign lead to member | no | yes | yes |
| Export leads CSV | no | yes | yes |
| Manage team members (add/edit/deactivate) | no | yes | yes |
| Manage admins (add/demote/remove) | no | no (confirm) | yes |
| Settings (profile, credit rate, etc.) | own profile only | yes (confirm) | yes |

## 3. Module features

### 3.1 Auth
- Login page with email and password (branded per prototype style).
- Session-based auth with role stored on the user; middleware guards every page and API route by role.
- Logout.
- Accounts are created by admins (no public signup). Password reset by admin.
- Optional later: invite email flow.

### 3.2 Social Planner (task board)
- 6 fixed stages, exactly as in the prototype: New Task, Working, Need Review (badge FOR YOU), Revision (badge FOR TEAM), Approved, Posted.
- Stats strip: Active tasks, Task cost in progress, Waiting for your review, Due in the next 7 days.
- Toolbar: priority pills (All/High/Medium/Low), clear filters, task type filter (Post/Reel/Video/Image), due date range picker, created date range picker, free-text search.
- Kanban columns with drag and drop between stages, with the prototype's drop highlight.
- Task card: id, type icon pill, priority pill, title, description, revision banner (red), reference row, submission link row, prompt row, created/due/cost grid, assignee avatar stack with names, comment count, last comment preview.
- Task modal, 3 panes exactly like the prototype:
  - Task: title, type segmented control, description, prompt, reference, submission link.
  - Schedule and ownership: stage select, created date (auto, readonly), due date, cost, priority segmented control, assignee chips (multi-select).
  - Revision and comments: revision description, comment list with author + timestamp + delete, post comment (Ctrl+Enter).
- Double-click confirm delete (like the prototype's "Click again to delete").
- Stage rules:
  - Approved and Posted are owner-only stages; team members cannot move cards there (locked, like the prototype's Team preview).
  - Moving a task to Revision implies a revision request is pending; moving to Need Review flags the card for the owner.
- Multi-assignee: one task can have several members; every assignee can edit the task and move its stage; non-assignees are read-only.
- Toasts for every action (created, saved, moved, deleted), styled like the prototype.
- Framer Motion micro animations: card hover lift, modal open, drop highlight, toast slide.

### 3.3 Website Leads
- Two views, toggle like the prototype: Table and Pipeline.
- Stats strip: Total leads, New in the last 7 days, Countries reached, Follow-ups due, Open pipeline value.
- Table view: sortable columns (name, phone, business, address, country, professional, value, stage, created), View button per row.
- Pipeline view: 6 columns (New Lead, Contacted, Qualified, Proposal Sent, Won, Lost) with drag and drop, per-column total value, lead cards with follow-up status and last activity snippet.
- Lead modal:
  - Contact pane: avatar, name, professional, business, call/email/WhatsApp chips, all fields; Edit details mode.
  - Pipeline pane: 6-step progress bar, stage buttons, days in pipeline, last activity, activities count, opportunity value, follow-up date with quick chips (Tomorrow, In 3 days, Next week, Clear), assignee chips.
  - Activity pane: log activity (type chips: note/call/email/meeting/message, text, logged-by select), full timeline with author and relative timestamps.
  - Delete lead with double-click confirm.
- Add lead modal with all prototype fields (first name required).
- Export CSV of the currently filtered list.
- Website form integration (future): leads submitted from the website land here with source "Contact form, Home page".
- Lead stages closed handling: Won/Lost set a closed date, shown as "Closed N days ago".

### 3.4 Team Management page (admin and super admin)
- List all members: avatar, name, email, role, status, open tasks count.
- Add team member (name, email, password, role member).
- Edit member, reset password, deactivate or remove.
- Promote member to admin (super admin only, if admin-management stays super-admin only).

### 3.5 Admin Management page (super admin only)
- List all admins.
- Add new admin (or promote a member).
- Demote admin back to member, or remove.
- Safety: the last super admin cannot be removed or demoted.

### 3.6 Settings page
- Profile: name, avatar, change own password (all roles).
- Global credit rate (dollars per credit, default 5) used for task cost defaults (admin/super admin, confirm).
- Danger zone: nothing destructive in v1.

## 4. Task-level rules (the important ones)

1. A team member can only open and change tasks where their user id is in the task's assignee list.
2. Tasks can have multiple assignees; all assignees have equal edit rights on that task.
3. Assignee rights stop at the Approved/Posted stages; only admin/super admin can move cards there (and back).
4. Only admin/super admin can change assignees, delete tasks, or write revision requests.
5. Leads visibility for team members is scoped to leads assigned to them (pending confirmation).

## 5. Tech stack (agreed)

- Next.js 15 (App Router), React 19, TypeScript.
- Tailwind CSS v4 with the Isa Melo design tokens (already applied in `app/globals.css`).
- shadcn/ui components (`components/ui`).
- Neon Postgres + Drizzle ORM (`lib/db`, migrations in `drizzle/`).
- TanStack Query for all server-state fetching and mutations.
- Zod for form and API validation (t3-env already in place for env vars).
- Framer Motion for micro animations.
- Vitest + Testing Library for unit tests, Playwright for e2e (port 3100).

## 6. Open questions (to confirm before build)

1. Can admins create other admins, or is admin management super-admin only? (Your message says both; the dedicated Manage Admins page is super admin, so I propose admin management = super admin only.)
2. Do team members see the whole board (read-only for other people's tasks, like the prototype's Team preview) or only their own tasks?
3. Do team members see leads at all? Proposal: only leads assigned to them, with activity logging and stage updates allowed.
4. Can team members create tasks for themselves, or is task creation admin-only?
5. Account creation flow: admin creates accounts with a password directly, or invite-by-email?

## 7. Database schema (final, implemented in `lib/db/schema.ts`)

- users: id, email (unique), passwordHash, name, role (member/admin/super_admin), status (active/inactive), avatarBg, avatarFg, lastLoginAt, createdAt, updatedAt
- sessions: id, userId, expiresAt, createdAt (revocable server sessions)
- tasks: id, number (serial for display id T-101), title, desc, prompt, ref, link, type, priority, stage, cost (numeric 10,2), due, revision, createdBy, deletedAt, createdAt, updatedAt
- task_assignees: taskId + userId composite PK, assignedAt (multi-assignee junction)
- comments: id, taskId, authorId, authorName (snapshot), text, createdAt
- leads: id, number (serial for display id L-1007), firstName, lastName, phone, email, business, info, address, country, professional, value (numeric 12,2), source, message, stage, assigneeId, followUp, closedAt, deletedAt, createdAt, updatedAt
- lead_activities: id, leadId, type, authorId, authorName (snapshot), text, createdAt
- settings: key (PK), value (JSONB), updatedBy, updatedAt
- audit_logs: id, userId, action, entityType, entityId, meta (JSONB), createdAt

Initial migration is committed in `drizzle/`. Value lists (stages, types, priorities, roles) live in `lib/db/enums.ts` with zod schemas.

## 8. Why future changes will not break existing data

1. UUID primary keys everywhere. Display ids (T-101, L-1007) come from a serial column, so they never collide, merge, or get reused.
2. Stages, types, priorities, roles are plain text columns validated by zod enums in code. Adding a new stage later is a code change, no ALTER on existing rows, and old rows stay valid.
3. Multi-assignee is a junction table, so any number of assignees per task, and "my tasks" queries stay fast.
4. Soft deletes on tasks and leads (deletedAt). Users are deactivated, never deleted, so comment history, activity timelines, and assignee links always survive.
5. Comment and activity rows store an authorName snapshot, so history stays readable even if a member is renamed or removed.
6. Settings is a JSONB key-value store: new settings (credit rate, extra config) need zero migrations.
7. Sessions live in the database, so password resets and deactivations instantly revoke logins.
8. Money fields are Postgres numeric (exact decimal), never floats.
9. Every write goes through zod-validated API routes, so DB constraints are the second line of defense, not the first.
10. Migrations are generated with drizzle-kit and committed; applied migrations are never edited, only appended.

## 9. Component organization for the build

The prototype HTML is the visual reference only. It gets rebuilt as organized Next.js components, not copied:

- layout: Topbar, Nav, Avatar
- planner: PlannerView, StatsStrip, PlannerToolbar (PriorityPills, TypeFilter, DateRangeFilter, TaskSearch), KanbanBoard, StageColumn, TaskCard, TaskModal (TaskFields, ScheduleFields, AssigneePicker, PriorityPicker, RevisionPanel, CommentThread), DateRangePopover
- leads: LeadsView, LeadsStats, LeadsToolbar (LeadSearch, ViewToggle, CountryFilter, StageFilter), LeadsTable, LeadsPipeline, LeadColumn, LeadCard, LeadModal (ContactPane, PipelinePane, ActivityPane, ActivityTimeline), AddLeadModal
- team: TeamPage, MemberTable, MemberForm
- admins: AdminsPage, AdminTable, AdminForm
- settings: SettingsPage, ProfileForm, RateForm
- shared: Avatar, AvatarStack, Toast, ConfirmDelete

Micro animations via Framer Motion; all server state via TanStack Query; every mutation zod-validated.
