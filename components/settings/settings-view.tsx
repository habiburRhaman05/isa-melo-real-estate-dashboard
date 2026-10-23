"use client"

import { useMutation } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { Fragment, useState } from "react"

import { Avatar } from "@/components/avatar"
import { FileUpload } from "@/components/file-upload"
import { useToast } from "@/components/toast"
import type { SessionUser } from "@/lib/auth"
import { AVATAR_PRESETS, ROLE_LABELS } from "@/lib/directory"
import { isOwnerRole } from "@/lib/permissions"

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new Error(data?.error ?? "Something went wrong")
  return data
}

export function SettingsView({
  user,
  creditRate,
}: {
  user: SessionUser
  creditRate: number
}) {
  const toast = useToast()
  const router = useRouter()
  const canEditRate = isOwnerRole(user)

  const [name, setName] = useState(user.name)
  const [avatar, setAvatar] = useState({ bg: user.avatarBg, fg: user.avatarFg })
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const [rate, setRate] = useState(String(creditRate))
  const [rateError, setRateError] = useState<string | null>(null)

  const profileMutation = useMutation({
    mutationFn: () =>
      send("/api/profile", "PATCH", {
        name: name.trim(),
        avatarBg: avatar.bg,
        avatarFg: avatar.fg,
        avatarUrl,
      }),
    onSuccess: () => {
      setProfileError(null)
      toast("Profile saved")
      /* the topbar avatar and name come from the server session */
      router.refresh()
    },
    onError: (error: Error) => setProfileError(error.message),
  })

  const passwordMutation = useMutation({
    mutationFn: () => send("/api/profile/password", "POST", { currentPassword, newPassword }),
    onSuccess: () => {
      setPasswordError(null)
      setCurrentPassword("")
      setNewPassword("")
      toast("Password changed. Other devices were signed out.")
    },
    onError: (error: Error) => setPasswordError(error.message),
  })

  const rateMutation = useMutation({
    mutationFn: () => send("/api/settings", "PATCH", { creditRate: Number(rate) }),
    onSuccess: () => {
      setRateError(null)
      toast("Credit rate saved")
    },
    onError: (error: Error) => setRateError(error.message),
  })

  return (
    <main className="px-6 py-9 pb-12">
      <div className="head">
        <div>
          <div className="eyebrow">Settings</div>
          <h1>Your account</h1>
          <p className="sub text-muted-foreground">
            How you show up on the board, how you sign in, and what work costs.
          </p>
        </div>
      </div>

      <div className="cards">
        <section className="scard">
          <div className="pane-t">Profile</div>
          <div className="who">
            <Avatar
              name={name || user.name}
              bg={avatar.bg}
              fg={avatar.fg}
              avatarUrl={avatarUrl}
              size={52}
              className="big"
            />
            <div>
              <div className="wn">{name || user.name}</div>
              <div className="muted">{ROLE_LABELS[user.role]}</div>
            </div>
          </div>
          <form
            className="flex flex-col gap-[14px]"
            onSubmit={(event) => {
              event.preventDefault()
              profileMutation.mutate()
            }}
          >
            <div className="fld">
              <label htmlFor="sName">Display name</label>
              <input
                id="sName"
                type="text"
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div className="fld">
              <span className="lbl">Profile photo</span>
              <div className="upl">
                <FileUpload
                  label={avatarUrl ? "Change photo" : "Upload photo"}
                  accept="image/*"
                  onUploaded={(url) => setAvatarUrl(url)}
                />
                {avatarUrl ? (
                  <button type="button" className="link-btn" onClick={() => setAvatarUrl(null)}>
                    Remove photo
                  </button>
                ) : null}
              </div>
            </div>
            <div className="fld">
              <span className="lbl">Avatar colour {avatarUrl ? <span className="hint">(used if you remove the photo)</span> : null}</span>
              <div className="people">
                {AVATAR_PRESETS.map((preset) => (
                  <Fragment key={preset.bg}>
                    <input
                      type="radio"
                      name="savatar"
                      id={`sav-${preset.bg.slice(1)}`}
                      checked={avatar.bg === preset.bg}
                      onChange={() => setAvatar({ bg: preset.bg, fg: preset.fg })}
                    />
                    <label htmlFor={`sav-${preset.bg.slice(1)}`} aria-label={`Avatar colour ${preset.bg}`}>
                      <Avatar name={name || user.name} bg={preset.bg} fg={preset.fg} size={24} />
                    </label>
                  </Fragment>
                ))}
              </div>
            </div>
            <div className="kv">
              <span>Email</span>
              <div>{user.email}</div>
            </div>
            {profileError ? (
              <div className="fmsg err" role="alert">
                {profileError}
              </div>
            ) : null}
            <div className="scard-foot">
              <button type="submit" className="btn-brand" disabled={profileMutation.isPending}>
                {profileMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                {profileMutation.isPending ? "Saving" : "Save profile"}
              </button>
            </div>
          </form>
        </section>

        <section className="scard">
          <div className="pane-t">Password</div>
          <h3>Change your password</h3>
          <p className="muted">
            Confirming your current password keeps anyone with your open laptop from taking the
            account. Every other device you are signed in on gets signed out.
          </p>
          <form
            className="flex flex-col gap-[14px]"
            autoComplete="off"
            onSubmit={(event) => {
              event.preventDefault()
              passwordMutation.mutate()
            }}
          >
            <div className="fld">
              <label htmlFor="sCur">Current password</label>
              <input
                id="sCur"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>
            <div className="fld">
              <label htmlFor="sNew">
                New password <span className="hint">(at least 8 characters)</span>
              </label>
              <input
                id="sNew"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </div>
            {passwordError ? (
              <div className="fmsg err" role="alert">
                {passwordError}
              </div>
            ) : null}
            <div className="scard-foot">
              <button type="submit" className="btn-brand" disabled={passwordMutation.isPending}>
                {passwordMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                {passwordMutation.isPending ? "Changing" : "Change password"}
              </button>
            </div>
          </form>
        </section>

        <section className="scard">
          <div className="pane-t">Workspace</div>
          <h3>Global credit rate</h3>
          <p className="muted">
            Dollars per credit, used as the default when pricing a task. Changing it never rewrites
            the cost already saved on an existing task.
          </p>
          <form
            className="flex flex-col gap-[14px]"
            onSubmit={(event) => {
              event.preventDefault()
              rateMutation.mutate()
            }}
          >
            <div className="rate">
              <span className="cur">$</span>
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                aria-label="Dollars per credit"
                value={rate}
                disabled={!canEditRate}
                onChange={(event) => setRate(event.target.value)}
              />
              <span>per credit</span>
            </div>
            {rateError ? (
              <div className="fmsg err" role="alert">
                {rateError}
              </div>
            ) : null}
            {canEditRate ? (
              <div className="scard-foot">
                <button type="submit" className="btn-brand" disabled={rateMutation.isPending}>
                  {rateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                  {rateMutation.isPending ? "Saving" : "Save rate"}
                </button>
              </div>
            ) : (
              <p className="muted">Only an admin can change the rate.</p>
            )}
          </form>
        </section>
      </div>
    </main>
  )
}
