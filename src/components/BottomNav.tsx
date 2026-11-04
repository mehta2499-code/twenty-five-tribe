import { Link, useLocation } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Circle, Camera, MessageCircle, Gamepad2, LayoutGrid } from "lucide-react";
import { useSocial } from "@/lib/social";

const tabs = [
  { to: "/app/home",  label: "Table", Icon: Circle },
  { to: "/app/feed",  label: "Feed",  Icon: LayoutGrid },
  { to: "/app/snap",  label: "Snap",  Icon: Camera },
  { to: "/app/chats", label: "Chats", Icon: MessageCircle },
  { to: "/app/games", label: "Games", Icon: Gamepad2 },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  const [pressed, setPressed] = useState<string | null>(null);
  const social = useSocial();
  const unread = Object.values(social.unread).reduce((a, b) => a + b, 0);
  const newSnaps = social.snaps.filter((x) => x.from !== "me" && !x.openedBy.includes("me")).length;

  useEffect(() => {
    if (!pressed) return;
    const t = setTimeout(() => setPressed(null), 1200);
    return () => clearTimeout(t);
  }, [pressed]);

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40"
      style={{
        background: "rgba(20,16,12,0.86)",
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
        borderTop: "1px solid rgba(239,230,210,0.05)",
      }}
    >
      <div className="mx-auto max-w-md flex items-center justify-around px-4 py-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {tabs.map(({ to, label, Icon }) => {
          const active = pathname.startsWith(to) || (to === "/app/feed" && pathname.startsWith("/app/reels"));
          const badge = to === "/app/chats" ? unread : to === "/app/snap" ? newSnaps : 0;
          const showLabel = pressed === to;
          return (
            <Link
              key={to}
              to={to}
              aria-label={label}
              onPointerDown={() => setPressed(to)}
              className="relative flex flex-col items-center justify-center active:scale-95 transition"
              style={{ width: 44, height: 32 }}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2 : 1.4}
                style={{
                  color: active ? "var(--accent-bronze)" : "rgba(184,169,152,0.55)",
                  filter: active ? "drop-shadow(0 0 8px rgba(196,149,96,0.55))" : "none",
                  transition: "all 240ms cubic-bezier(0.22,0.61,0.36,1)",
                }}
                fill="none"
              />
              {badge > 0 && (
                <span className="absolute -top-1 right-1 min-w-4 h-4 px-1 rounded-full flex items-center justify-center tabular-nums"
                      style={{ background: "var(--accent-oxblood)", color: "var(--bg-cream)", fontSize: 9, fontWeight: 600 }}>
                  {badge}
                </span>
              )}
              {showLabel && (
                <span
                  className="font-display italic absolute -top-7 whitespace-nowrap px-2 py-0.5 rounded-full animate-soft-in"
                  style={{
                    fontSize: 11,
                    color: "var(--bg-cream)",
                    background: "rgba(40,32,26,0.95)",
                    border: "1px solid var(--border-cool)",
                  }}
                >
                  {label}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
