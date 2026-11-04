import { Clapperboard, HelpCircle, Map, Music, Smile, Trophy, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  ipl: Trophy,
  bolly00s: Clapperboard,
  indiagk: Map,
  hindimusic: Music,
  desilife: Smile,
};

/** Icon for a trivia pack, in a soft tile. */
export function PackIcon({ id, size = 40 }: { id: string; size?: number }) {
  const Icon = ICONS[id] ?? HelpCircle;
  return (
    <span
      className="inline-flex items-center justify-center rounded-xl shrink-0"
      style={{ width: size, height: size, background: "var(--fill)", color: "var(--blue-deep)" }}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.5)} />
    </span>
  );
}
