"use client"

import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { Fragment, useEffect, useState } from "react"

import { Avatar } from "@/components/avatar"
import { FileUpload } from "@/components/file-upload"
import type { SessionUser } from "@/lib/auth"
import type { DirectoryUser } from "@/lib/db/queries"
import type { Role } from "@/lib/db/enums"
import { AVATAR_PRESETS, ROLE_LABELS } from "@/lib/directory"
import { assignableRoles, isSelf } from "@/lib/permissions"

export type UserDraft = {
  name: string
  email: string
  password: string
  role: Role
  avatarBg: string
  avatarFg: string
  avatarUrl: string | null
}

function toDraft(user: DirectoryUser | null, fallbackRole: Role): UserDraft {
  if (!user) {
    const preset = AVATAR_PRESETS[0]!
    return {
      name: "",
      email: "",
      password: "",
      role: fallbackRole,
      avatarBg: preset.bg,
      avatarFg: preset.fg,
      avatarUrl: null,
    }
  }
  return {
    name: user.name,
    email: user.email,
    password: "",
    role: user.role,
    avatarBg: user.avatarBg,
    avatarFg: user.avatarFg,
    avatarUrl: user.avatarUrl,
  }
}

export function UserModal({
  user,
  currentUser,
  defaultRole,
  saving,
  error,
  onSave,
  onClose,
}: {
  user: DirectoryUser | null
  currentUser: SessionUser
  defaultRole: Role
  saving: boolean
  error: string | null
  onSave: (draft: UserDraft) => void
  onClose: () => void
}) {
  const isCreate = user === null
  const [draft, setDraft] = useState<UserDraft>(() => toDraft(user, defaultRole))

  const roles = assignableRoles(currentUser)
  /* an account's current role stays selectable even when the actor could not
     grant it, so an admin editing a name doesn't silently demote anyone */
  const roleOptions = user && !roles.includes(user.role) ? [user.role, ...roles] : roles
  const lockRole = Boolean(user && isSelf(currentUser, user))

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    onSave(draft)
  }

  return (
    <motion.div
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <motion.div
        className="modal sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-modal-title"
        initial={{ opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.985 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <div className="m-head">
          <div>
            <div className="eyebrow">{isCreate ? "New account" : "Edit account"}</div>
            <h2 id="user-modal-title">{isCreate ? "Add a person" : draft.name || "Account"}</h2>
          </div>
          <button type="button" className="x" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={onSubmit} autoComplete="off">
          <div className="addg">
            <div className="fld">
              <label htmlFor="uName">Full name</label>
              <input
                id="uName"
                type="text"
                maxLength={80}
                placeholder="e.g. Rakib Hasan"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                required
              />
            </div>
            <div className="fld">
              <label htmlFor="uEmail">Email</label>
              <input
                id="uEmail"
                type="email"
                placeholder="name@isamelo.com"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                required
              />
            </div>
            {isCreate ? (
              <div className="fld full">
                <label htmlFor="uPass">
                  Password <span className="hint">(at least 8 characters)</span>
                </label>
                <input
                  id="uPass"
                  type="text"
                  autoComplete="new-password"
                  placeholder="Share this with them, they can change it in Settings"
                  value={draft.password}
                  onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                  required
                />
              </div>
            ) : null}
            <div className="fld">
              <label htmlFor="uRole">Role</label>
              <select
                id="uRole"
                value={draft.role}
                disabled={lockRole || roleOptions.length < 2}
                onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              {lockRole ? <span className="hint">You can&apos;t change your own role.</span> : null}
            </div>
            <div className="fld full">
              <span className="lbl">Profile photo</span>
              <div className="who">
                <Avatar
                  name={draft.name || "?"}
                  bg={draft.avatarBg}
                  fg={draft.avatarFg}
                  avatarUrl={draft.avatarUrl}
                  size={44}
                />
                <div className="upl">
                  <FileUpload
                    label={draft.avatarUrl ? "Change photo" : "Upload photo"}
                    accept="image/*"
                    onUploaded={(url) => setDraft({ ...draft, avatarUrl: url })}
                  />
                  {draft.avatarUrl ? (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => setDraft({ ...draft, avatarUrl: null })}
                    >
                      Remove photo
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="fld">
              <span className="lbl">Avatar colour {draft.avatarUrl ? <span className="hint">(used if the photo is removed)</span> : null}</span>
              <div className="people">
                {AVATAR_PRESETS.map((preset) => (
                  <Fragment key={preset.bg}>
                    <input
                      type="radio"
                      name="avatar"
                      id={`av-${preset.bg.slice(1)}`}
                      checked={draft.avatarBg === preset.bg}
                      onChange={() => setDraft({ ...draft, avatarBg: preset.bg, avatarFg: preset.fg })}
                    />
                    <label htmlFor={`av-${preset.bg.slice(1)}`} aria-label={`Avatar colour ${preset.bg}`}>
                      <Avatar name={draft.name} bg={preset.bg} fg={preset.fg} size={24} />
                    </label>
                  </Fragment>
                ))}
              </div>
            </div>
            {error ? (
              <div className="full fmsg err" role="alert">
                {error}
              </div>
            ) : null}
          </div>
          <div className="m-foot standalone">
            <div className="right">
              <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn-brand" disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                {isCreate ? (saving ? "Adding" : "Add person") : saving ? "Saving" : "Save changes"}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
