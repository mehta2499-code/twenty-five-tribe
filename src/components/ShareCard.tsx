import { useState } from "react";
import { Share2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useSocial } from "@/lib/social";
import { shareCard, shareUrl } from "@/lib/vibes";

/**
 * "Are you in my 25?" — the card people screenshot for their story,
 * plus a share button for the link that lets friends prove it.
 */
export function ShareCard({ compact = false }: { compact?: boolean }) {
  const s = useSocial();
  const [status, setStatus] = useState<string | null>(null);
  if (!s.me) return null;
  const me = s.me;
  const link = shareUrl(me.username).replace(/^https?:\/\//, "");
  const filled = s.people.length;

  const share = async () => {
    const r = await shareCard(me.username, me.name);
    setStatus(
      r === "copied"
        ? "Link copied. Paste it in your story or group chat."
        : r === "failed"
          ? `Copy this link: ${shareUrl(me.username)}`
          : null,
    );
  };

  return (
    <section className={compact ? "" : "px-5 mt-2"} aria-label="Share your card">
      <div
        className="relative overflow-hidden rounded-[24px] p-5"
        style={{
          background: "var(--violet)",
          color: "#fff",
          border: "2px solid var(--ink)",
          boxShadow: "var(--pop-lg)",
        }}
      >
        <span className="sticker sun absolute right-4 top-4" style={{ transform: "rotate(6deg)" }}>
          {filled}/25
        </span>
        <div className="flex items-center gap-3">
          <span
            className="rounded-full"
            style={{ border: "2px solid var(--ink)", boxShadow: "2px 2px 0 var(--ink)" }}
          >
            <Avatar src={me.avatar} initials={me.initials} color="#FF5FA2" size={48} />
          </span>
          <div className="min-w-0">
            <p className="font-extrabold truncate">{me.name}</p>
            <p className="text-sm opacity-90 truncate">@{me.username}</p>
          </div>
        </div>
        <p
          className="display mt-4"
          style={{ fontSize: 40, lineHeight: 0.95, fontWeight: 800, letterSpacing: "-0.04em" }}
        >
          Are you in
          <br />
          my <span style={{ color: "var(--lime)" }}>25</span>?
        </p>
        <p className="mt-2 text-sm opacity-90">Prove it: guess 4 of my 6 answers.</p>
        <p
          className="mt-3 inline-block rounded-full px-3 py-1 text-[13px] font-bold"
          style={{ background: "rgba(255,255,255,0.18)" }}
        >
          {link}
        </p>
      </div>
      <button onClick={() => void share()} className="btn-fun w-full mt-3">
        <Share2 size={18} /> Share my card
      </button>
      {status && (
        <p className="mt-2 text-center meta" role="status" style={{ overflowWrap: "anywhere" }}>
          {status}
        </p>
      )}
    </section>
  );
}
