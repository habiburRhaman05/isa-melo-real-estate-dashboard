import {
  Bookmark,
  CalendarDays,
  Clapperboard,
  FileText,
  Image as ImageIcon,
  Link2,
  type LucideIcon,
  MessageSquare,
  MessageSquareText,
  Video,
} from "lucide-react"

import type { TaskType } from "@/lib/db/enums"

export const TASK_TYPE_ICONS: Record<TaskType, LucideIcon> = {
  post: FileText,
  reel: Clapperboard,
  video: Video,
  image: ImageIcon,
}

export const CARD_ICONS = {
  ref: Bookmark,
  link: Link2,
  prompt: MessageSquareText,
} as const

export { CalendarDays, MessageSquare }
