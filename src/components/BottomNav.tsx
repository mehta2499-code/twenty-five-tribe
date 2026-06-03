import { Link, useLocation } from "@tanstack/react-router";

const tabs = [
  { to: "/app/home",     label: "Table" },
  { to: "/app/moments",  label: "Moments" },
  { to: "/app/thoughts", label: "Thought of You" },
  { to: "/app/games",    label: "Games" },
  { to: "/app/profile",  label: "You" },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40"
      style={{
        background: "rgba(11,26,42,0.94)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        borderTop: "1px solid rgba(243,233,210,0.06)",
      }}
    >
      <div className="mx-auto max-w-md flex items-center justify-around px-2 py-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tabs.map(({ to, label }) => {
          const active = pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              aria-label={label}
              className="relative flex flex-col items-center py-1 px-2 active:scale-105 transition"
            >
              <span
                className="font-display italic whitespace-nowrap"
                style={{
                  fontSize: 14,
                  color: active ? "var(--accent-gold)" : "rgba(159,176,191,0.65)",
                  textShadow: active ? "0 0 12px rgba(226,184,115,0.5)" : "none",
                  letterSpacing: "0.01em",
                }}
              >
                {label}
              </span>
              <span
                className="mt-1 rounded-full transition-all"
                style={{
                  width: active ? 4 : 0,
                  height: 4,
                  background: active ? "var(--accent-gold)" : "transparent",
                  boxShadow: active ? "0 0 8px rgba(226,184,115,0.8)" : "none",
                }}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
