export function Avatar({
  name,
  bg,
  fg,
  avatarUrl,
  size = 28,
  className,
}: {
  name: string
  bg: string
  fg: string
  avatarUrl?: string | null
  size?: number
  className?: string
}) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- third-party CDN, fixed small circular thumbnail
      <img
        src={avatarUrl}
        alt=""
        aria-hidden
        className={`av ${className ?? ""}`.trim()}
        style={{ width: size, height: size, objectFit: "cover" }}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={`av ${className ?? ""}`.trim()}
      style={{ background: bg, color: fg, width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials}
    </span>
  )
}
