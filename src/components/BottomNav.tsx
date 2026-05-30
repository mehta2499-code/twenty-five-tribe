import { Link, useLocation } from "@tanstack/react-router";
import { Home, Grid2x2, Sparkles, Gamepad2, User } from "lucide-react";

const tabs = [
  { to: "/app/home",    Icon: Home,     label: "Home" },
  { to: "/app/my25",    Icon: Grid2x2,  label: "My 25" },
  { to: "/app/pulse",   Icon: Sparkles, label: "AI" },
  { to: "/app/games",   Icon: Gamepad2, label: "Play" },
  { to: "/app/profile", Icon: User,     label: "You" },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40"
      style={{
        background: "rgba(13,24,32,0.92)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        borderTop: "1px solid rgba(122,150,170,0.15)",
      }}
    >
      <div className="mx-auto max-w-md flex items-center justify-around px-4 py-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tabs.map(({ to, Icon, label }) => {
          const active = pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              aria-label={label}
              className="relative flex flex-col items-center py-1.5 px-3 active:scale-110 transition-transform"
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.2 : 1.7}
                style={{
                  color: active ? "#D4A96A" : "rgba(138,156,170,0.7)",
                  filter: active ? "drop-shadow(0 0 8px rgba(212,169,106,0.55))" : undefined,
                }}
              />
              <span
                className="mt-1.5 rounded-full transition-all"
                style={{
                  width: active ? 6 : 0,
                  height: 2,
                  background: active ? "#D4A96A" : "transparent",
                  boxShadow: active ? "0 0 6px rgba(212,169,106,0.75)" : "none",
                }}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
