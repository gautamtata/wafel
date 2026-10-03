import { Drama, GraduationCap, type LucideIcon, MessagesSquare, PenLine, Repeat2 } from "lucide-react";
import type { SessionType } from "@/generated/prisma/enums";

export const SESSION_TYPE_ICONS: Record<SessionType, LucideIcon> = {
  SHADOWING: Repeat2,
  LESSON: GraduationCap,
  ROLEPLAY: Drama,
  FREE_TALK: MessagesSquare,
  MISTAKE_REVIEW: PenLine,
};
