import { Trophy } from "lucide-react";
import { useSeasonWins } from "@/lib/seasons";

/** Gold "Season winner" badge on a profile (nothing if they've never won one). */
export function SeasonBadge({ userId }: { userId?: string | null }) {
  const wins = useSeasonWins(userId);
  if (!wins.length) return null;
  const label = wins.length === 1 ? `Season ${wins[0]} winner` : `${wins.length}× season winner`;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-3 py-1 font-extrabold"
      style={{
        background: "linear-gradient(135deg, #FBE08A, #E9A825)",
        color: "#3A2606",
        fontSize: 12.5,
        boxShadow: "0 0 0 1.5px #9C6F14, 0 4px 14px rgba(233,168,37,0.35)",
      }}
      title={wins.length > 1 ? `Won seasons ${[...wins].reverse().join(", ")}` : undefined}
    >
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center"
        style={{ background: "#3A2606", color: "#F7C948" }}
      >
        <Trophy size={12} aria-hidden="true" />
      </span>
      {label}
    </span>
  );
}
