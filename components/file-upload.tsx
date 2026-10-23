"use client"

import { Loader2, Paperclip } from "lucide-react"
import { useId, useRef, useState } from "react"

type UploadResponse = { url?: string; name?: string; error?: string }

/* Pushes the chosen file into GoHighLevel media storage and hands the public
   CDN url back, so the field next to it ends up holding a link the whole team
   can open - same shape as a pasted Drive or Frame.io url. */
export function FileUpload({
  label = "Upload file",
  accept,
  disabled = false,
  onUploaded,
}: {
  label?: string
  accept?: string
  disabled?: boolean
  onUploaded: (url: string, name: string) => void
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  async function upload(file: File) {
    setBusy(true)
    setFailed(false)
    setNote(`Uploading ${file.name}`)

    try {
      const body = new FormData()
      body.set("file", file)
      body.set("name", file.name)

      const res = await fetch("/api/media/upload", { method: "POST", body })
      const data = (await res.json().catch(() => null)) as UploadResponse | null

      if (!res.ok || !data?.url) {
        setFailed(true)
        setNote(data?.error ?? "Upload failed. Try again.")
        return
      }

      onUploaded(data.url, data.name ?? file.name)
      setNote(`${file.name} uploaded`)
    } catch {
      setFailed(true)
      setNote("Network error. Check your connection and try again.")
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="upl">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled || busy}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
        }}
      />
      <button
        type="button"
        className="vb"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
        {busy ? "Uploading" : label}
      </button>
      {note ? <span className={`note ${failed ? "err" : ""}`.trim()}>{note}</span> : null}
    </div>
  )
}
