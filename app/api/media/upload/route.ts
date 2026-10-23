import { NextResponse } from "next/server"

import { getApiUser } from "@/lib/auth"
import { GhlMediaError, uploadMediaFile } from "@/lib/ghl"

/* GoHighLevel caps uploads at 25 MB; reject early so a large file isn't
   streamed all the way to them just to come back as a 413. */
const MAX_BYTES = 25 * 1024 * 1024

export async function POST(request: Request) {
  const { user, response } = await getApiUser()
  if (!user) return response

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "Send the file as multipart form data" }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a file to upload" }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Files must be 25 MB or smaller" }, { status: 413 })
  }

  const name = typeof form.get("name") === "string" ? (form.get("name") as string) : file.name

  try {
    const result = await uploadMediaFile(file, name)
    return NextResponse.json({ fileId: result.fileId, url: result.url, name }, { status: 201 })
  } catch (error) {
    if (error instanceof GhlMediaError) {
      /* the upstream status is theirs, not the caller's: surface a clean 502 */
      const status = error.status === 500 ? 500 : 502
      return NextResponse.json({ error: describeGhlError(error) }, { status })
    }
    return NextResponse.json({ error: "File upload failed. Try again." }, { status: 502 })
  }
}

/* GHL only accepts media/document types it recognises (images, video, PDF,
   office docs, ...); surface that reason instead of a generic failure so the
   person uploading knows to pick a different file rather than retry blindly. */
function describeGhlError(error: GhlMediaError): string {
  if (error.code === "INVALID_FILE_TYPE") {
    return "That file type isn't supported. Try an image, video, PDF, or document file instead."
  }
  if (error.status === 413 || /too large/i.test(error.message)) {
    return "That file is too large for GHL media storage. Try a smaller file."
  }
  return "File upload failed. Try again."
}
