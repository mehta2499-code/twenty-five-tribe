import { Link, useLocation } from "@tanstack/react-router";
import { Home, Grid2x2, Activity, Gamepad2, User } from "lucide-react";

const tabs = [
  { to: "/app/home",    Icon: Home,    label: "Home" },
  { to: "/app/my25",    Icon: Grid2x2, label: "My 25" },
  { to: "/app/pulse",   Icon: Activity,label: "Pulse" },
  { to: "/app/games",   Icon: Gamepad2,label: "Play" },
  { to: "/app/profile", Icon: User,    label: "You" },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40"
      style={{
        background: "rgba(13,13,15,0.85)",
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        borderTop: "1px solid rgba(127,119,221,0.15)",
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
                  color: active ? "#7F77DD" : "#3A3A4A",
                  filter: active ? "drop-shadow(0 0 10px rgba(127,119,221,0.55))" : undefined,
                }}
              />
              <span
                className="mt-1 h-[3px] w-2 rounded-full transition-all"
                style={{
                  background: active ? "#7F77DD" : "transparent",
                  boxShadow: active ? "0 0 8px rgba(127,119,221,0.7)" : "none",
                }}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
