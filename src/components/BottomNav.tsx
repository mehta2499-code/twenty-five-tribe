import { Link, useLocation } from "@tanstack/react-router";
import { Home, Grid2x2, Sparkles, Gamepad2, User } from "lucide-react";

const tabs = [
  { to: "/app/home",    Icon: Home,     label: "Home" },
  { to: "/app/my25",    Icon: Grid2x2,  label: "My 25" },
  { to: "/app/ai",      Icon: Sparkles, label: "AI" },
  { to: "/app/games",   Icon: Gamepad2, label: "Play" },
  { to: "/app/profile", Icon: User,     label: "You" },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40"
      style={{
        background: "rgba(26,82,118,0.55)",
        backdropFilter: "blur(22px) saturate(170%)",
        WebkitBackdropFilter: "blur(22px) saturate(170%)",
        borderTop: "1px solid rgba(255,255,255,0.22)",
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
                size={24}
                strokeWidth={active ? 2.4 : 1.9}
                style={{
                  color: active ? "#F7A8A0" : "rgba(255,255,255,0.55)",
                  filter: active ? "drop-shadow(0 0 10px rgba(247,168,160,0.75))" : undefined,
                }}
              />
              <span
                className="mt-1 h-[3px] w-2 rounded-full transition-all"
                style={{
                  background: active ? "#F7A8A0" : "transparent",
                  boxShadow: active ? "0 0 8px rgba(247,168,160,0.85)" : "none",
                }}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
