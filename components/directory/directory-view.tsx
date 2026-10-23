"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence } from "framer-motion"
import { KeyRound, Loader2, Pencil, Plus, RotateCcw, UserMinus } from "lucide-react"
import { useState } from "react"

import { Avatar } from "@/components/avatar"
import { useToast } from "@/components/toast"
import type { SessionUser } from "@/lib/auth"
import type { Role } from "@/lib/db/enums"
import type { DirectoryUser } from "@/lib/db/queries"
import { fmtLastLogin, ROLE_SHORT, STATUS_LABELS } from "@/lib/directory"
import { canManageUser, isSelf } from "@/lib/permissions"

import { PasswordModal } from "./password-modal"
import { type UserDraft, UserModal } from "./user-modal"

async function fetchDirectory(): Promise<DirectoryUser[]> {
  const res = await fetch("/api/users?scope=directory")
  if (!res.ok) throw new Error("Failed to load the roster")
  const data = (await res.json()) as { users: DirectoryUser[] }
  return data.users
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new Error(data?.error ?? "Something went wrong")
  return data
}

export function DirectoryView({
  currentUser,
  initialUsers,
  roles,
  defaultRole,
  eyebrow,
  title,
  intro,
  addLabel,
  emptyLabel,
}: {
  currentUser: SessionUser
  initialUsers: DirectoryUser[]
  /* which accounts this page is responsible for */
  roles: Role[]
  defaultRole: Role
  eyebrow: string
  title: string
  intro: string
  addLabel: string
  emptyLabel: string
}) {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [editing, setEditing] = useState<DirectoryUser | null>(null)
  const [creating, setCreating] = useState(false)
  const [resetting, setResetting] = useState<DirectoryUser | null>(null)
  const [armedId, setArmedId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: users = [] } = useQuery({
    queryKey: ["directory", "users"],
    queryFn: fetchDirectory,
    initialData: initialUsers,
  })

  const rows = users.filter((user) => roles.includes(user.role))

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["directory", "users"] })
    void queryClient.invalidateQueries({ queryKey: ["planner", "tasks"] })
  }

  function closeForms() {
    setEditing(null)
    setCreating(false)
    setResetting(null)
    setFormError(null)
  }

  const createMutation = useMutation({
    mutationFn: (draft: UserDraft) => send("/api/users", "POST", draft),
    onSuccess: (_data, draft) => {
      invalidate()
      toast(`${draft.name} added`)
      closeForms()
    },
    onError: (error: Error) => setFormError(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: UserDraft }) =>
      send(`/api/users/${id}`, "PATCH", {
        name: draft.name,
        email: draft.email,
        role: draft.role,
        avatarBg: draft.avatarBg,
        avatarFg: draft.avatarFg,
        avatarUrl: draft.avatarUrl,
      }),
    onSuccess: (_data, variables) => {
      invalidate()
      toast(`${variables.draft.name} saved`)
      closeForms()
    },
    onError: (error: Error) => setFormError(error.message),
  })

  const passwordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      send(`/api/users/${id}/password`, "POST", { password }),
    onSuccess: () => {
      invalidate()
      toast("Password updated")
      closeForms()
    },
    onError: (error: Error) => setFormError(error.message),
  })

  const statusMutation = useMutation({
    mutationFn: ({ user, status }: { user: DirectoryUser; status: "active" | "inactive" }) =>
      send(`/api/users/${user.id}`, "PATCH", { status }),
    onSuccess: (_data, variables) => {
      invalidate()
      setArmedId(null)
      toast(
        variables.status === "inactive"
          ? `${variables.user.name} deactivated`
          : `${variables.user.name} reactivated`,
      )
    },
    onError: (error: Error) => {
      setArmedId(null)
      toast(error.message)
    },
  })

  function onDeactivate(user: DirectoryUser) {
    if (armedId !== user.id) {
      setArmedId(user.id)
      return
    }
    statusMutation.mutate({ user, status: "inactive" })
  }

  const saving =
    createMutation.isPending || updateMutation.isPending || passwordMutation.isPending

  return (
    <main className="px-6 py-9 pb-12">
      <div className="head">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <p className="sub text-muted-foreground">{intro}</p>
        </div>
        <div className="head-right">
          <button
            type="button"
            className="btn-brand"
            onClick={() => {
              setFormError(null)
              setCreating(true)
            }}
          >
            <Plus size={16} strokeWidth={2.4} />
            {addLabel}
          </button>
        </div>
      </div>

      <div className="tw" style={{ marginTop: 28 }}>
        {rows.length > 0 ? (
          <table className="lt">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Status</th>
                <th>Open tasks</th>
                <th>Last sign-in</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => {
                const manageable = canManageUser(currentUser, user)
                const self = isSelf(currentUser, user)
                const armed = armedId === user.id
                const statusBusy = statusMutation.isPending && statusMutation.variables?.user.id === user.id

                return (
                  <tr key={user.id} className={user.status === "inactive" ? "off" : undefined}>
                    <td>
                      <div className="nm">
                        <Avatar
                          name={user.name}
                          bg={user.avatarBg}
                          fg={user.avatarFg}
                          avatarUrl={user.avatarUrl}
                          size={34}
                        />
                        <div>
                          {user.name}
                          {self ? <span className="pp brand" style={{ marginLeft: 8 }}>You</span> : null}
                          <small>{user.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`pp ${user.role === "member" ? "" : "gold"}`}>
                        {ROLE_SHORT[user.role]}
                      </span>
                    </td>
                    <td>
                      <span className={`sp ${user.status}`}>
                        <i />
                        {STATUS_LABELS[user.status]}
                      </span>
                    </td>
                    <td>{user.openTasks}</td>
                    <td>{fmtLastLogin(user.lastLoginAt)}</td>
                    <td>
                      <div className="row-acts">
                        <button
                          type="button"
                          className="vb"
                          disabled={!manageable}
                          onClick={() => {
                            setFormError(null)
                            setEditing(user)
                          }}
                        >
                          <Pencil size={14} />
                          Edit
                        </button>
                        <button
                          type="button"
                          className="vb"
                          disabled={!manageable}
                          onClick={() => {
                            setFormError(null)
                            setResetting(user)
                          }}
                        >
                          <KeyRound size={14} />
                          Password
                        </button>
                        {user.status === "active" ? (
                          <button
                            type="button"
                            className={`vb danger ${armed ? "confirm" : ""}`.trim()}
                            disabled={!manageable || self || statusBusy}
                            onClick={() => onDeactivate(user)}
                            onBlur={() => setArmedId((id) => (id === user.id ? null : id))}
                          >
                            {statusBusy ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <UserMinus size={14} />
                            )}
                            {statusBusy ? "Deactivating" : armed ? "Click again" : "Deactivate"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="vb"
                            disabled={!manageable || statusBusy}
                            onClick={() => statusMutation.mutate({ user, status: "active" })}
                          >
                            {statusBusy ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <RotateCcw size={14} />
                            )}
                            {statusBusy ? "Reactivating" : "Reactivate"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="lempty">{emptyLabel}</div>
        )}
      </div>

      <AnimatePresence>
        {creating ? (
          <UserModal
            key="create"
            user={null}
            currentUser={currentUser}
            defaultRole={defaultRole}
            saving={saving}
            error={formError}
            onSave={(draft) => createMutation.mutate(draft)}
            onClose={closeForms}
          />
        ) : editing ? (
          <UserModal
            key={editing.id}
            user={editing}
            currentUser={currentUser}
            defaultRole={defaultRole}
            saving={saving}
            error={formError}
            onSave={(draft) => updateMutation.mutate({ id: editing.id, draft })}
            onClose={closeForms}
          />
        ) : resetting ? (
          <PasswordModal
            key={`pw-${resetting.id}`}
            user={resetting}
            saving={saving}
            error={formError}
            onSave={(password) => passwordMutation.mutate({ id: resetting.id, password })}
            onClose={closeForms}
          />
        ) : null}
      </AnimatePresence>
    </main>
  )
}
