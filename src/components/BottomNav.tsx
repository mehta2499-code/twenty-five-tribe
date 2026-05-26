import { Link, useLocation } from "@tanstack/react-router";
import { Home, Grid2x2, Activity, Camera, User } from "lucide-react";

const tabs = [
  { to: "/app/home",    Icon: Home },
  { to: "/app/my25",    Icon: Grid2x2 },
  { to: "/app/pulse",   Icon: Activity },
  { to: "/app/moments", Icon: Camera },
  { to: "/app/profile", Icon: User },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-background/85 backdrop-blur-xl border-t border-border">
      <div className="mx-auto max-w-md flex items-center justify-around px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {tabs.map(({ to, Icon }) => {
          const active = pathname.startsWith(to);
          return (
            <Link key={to} to={to} className="p-2 -m-2" aria-label={to}>
              <Icon
                size={26}
                strokeWidth={active ? 2.4 : 2}
                className={active ? "text-primary" : "text-muted-foreground"}
                style={active ? { filter: "drop-shadow(0 0 8px color-mix(in oklab, var(--primary) 70%, transparent))" } : undefined}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
