import { Link, useLocation } from "@tanstack/react-router";
import { Camera, Gamepad2, LayoutGrid, MessageCircle, Users } from "lucide-react";
import { useSocial } from "@/lib/social";
import { buzz } from "@/components/SocialUI";

const tabs = [
  { to: "/app/home", label: "Table", Icon: Users },
  { to: "/app/feed", label: "Feed", Icon: LayoutGrid },
  { to: "/app/snap", label: "Blink", Icon: Camera },
  { to: "/app/chats", label: "Chats", Icon: MessageCircle },
  { to: "/app/games", label: "Games", Icon: Gamepad2 },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  const social = useSocial();
  const unread = Object.values(social.unread).reduce((a, b) => a + b, 0);
  const newSnaps = social.snaps.filter((x) => x.from !== "me" && !x.openedBy.includes("me")).length;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 z-40 px-3 pointer-events-none"
      style={{ bottom: "max(0.75rem, calc(env(safe-area-inset-bottom) - 0.5rem))" }}
    >
      <ul
        className="pointer-events-auto mx-auto max-w-[420px] grid grid-cols-5 items-end px-1 pb-0.5 rounded-[26px]"
        style={{
          background: "color-mix(in srgb, var(--surface) 94%, transparent)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid var(--line)",
          boxShadow: "0 16px 36px rgba(0, 0, 0, 0.45)",
        }}
      >
        {tabs.map(({ to, label, Icon }) => {
          const active =
            pathname.startsWith(to) ||
            (to === "/app/home" &&
              (pathname.startsWith("/app/people") || pathname.startsWith("/app/seat")));
          const badge = to === "/app/chats" ? unread : to === "/app/snap" ? newSnaps : 0;
          const color = active ? "var(--lime)" : "var(--ink-2)";
          const isSnap = to === "/app/snap";
          return (
            <li key={to}>
              <Link
                to={to}
                {...(isSnap ? { search: { to: undefined } } : {})}
                aria-label={badge ? `${label}, ${badge} new` : label}
                aria-current={active ? "page" : undefined}
                onClick={() => buzz(8)}
                className="flex flex-col items-center justify-end gap-0.5 pt-1.5 pb-1 min-h-[56px]"
              >
                {isSnap ? (
                  <span
                    className="relative -mt-6 w-[58px] h-[58px] rounded-[20px] flex items-center justify-center"
                    style={{
                      background: "var(--lime)",
                      color: "var(--on-dark-fill)",
                      border: "var(--bd)",
                      boxShadow: active
                        ? "0 0 0 3px rgba(193, 239, 98, 0.28), var(--pop)"
                        : "var(--pop)",
                      transform: "rotate(-4deg)",
                    }}
                  >
                    <Camera size={26} strokeWidth={2.4} />
                    {badge > 0 && <Badge n={badge} />}
                  </span>
                ) : (
                  <span
                    className="relative flex items-center justify-center w-12 h-8 rounded-xl"
                    style={{
                      background: active ? "rgba(193, 239, 98, 0.14)" : "transparent",
                      color,
                      transition: "background-color 180ms var(--ease), color 180ms var(--ease)",
                    }}
                  >
                    <Icon size={21} strokeWidth={2.25} />
                    {badge > 0 && <Badge n={badge} />}
                  </span>
                )}
                <span style={{ fontSize: 11.5, fontWeight: active ? 700 : 600, color }}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span
      key={n}
      aria-hidden="true"
      className="pop absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center tabular-nums"
      style={{
        background: "var(--pink)",
        color: "var(--on-dark-fill)",
        fontSize: 11,
        fontWeight: 800,
        border: "2px solid var(--surface)",
      }}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}
