import { Link, useLocation } from "@tanstack/react-router";
import { Camera, Gamepad2, LayoutGrid, MessageCircle, Users } from "lucide-react";
import { useSocial } from "@/lib/social";
import { buzz } from "@/components/SocialUI";

const tabs = [
  { to: "/app/home", label: "Table", Icon: Users },
  { to: "/app/feed", label: "Feed", Icon: LayoutGrid },
  { to: "/app/snap", label: "Snap", Icon: Camera },
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
      className="fixed bottom-0 inset-x-0 z-40 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
      style={{
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: "1px solid var(--line)",
      }}
    >
      <ul className="mx-auto max-w-md grid grid-cols-5 items-end px-1">
        {tabs.map(({ to, label, Icon }) => {
          const active =
            pathname.startsWith(to) ||
            (to === "/app/feed" && pathname.startsWith("/app/reels")) ||
            (to === "/app/home" &&
              (pathname.startsWith("/app/people") ||
                pathname.startsWith("/app/seat") ||
                pathname.startsWith("/app/my25")));
          const badge = to === "/app/chats" ? unread : to === "/app/snap" ? newSnaps : 0;
          const color = active ? "var(--blue-deep)" : "var(--ink-3)";
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
                    className="relative -mt-5 w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{
                      background: active ? "var(--navy)" : "var(--blue-deep)",
                      color: "#fff",
                      boxShadow: "0 0 0 4px #fff, var(--shadow-pop)",
                    }}
                  >
                    <Camera size={24} strokeWidth={2} />
                    {badge > 0 && <Badge n={badge} />}
                  </span>
                ) : (
                  <span
                    className="relative flex items-center justify-center w-12 h-8 rounded-lg"
                    style={{ background: active ? "var(--fill)" : "transparent", color }}
                  >
                    <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                    {badge > 0 && <Badge n={badge} />}
                  </span>
                )}
                <span style={{ fontSize: 12, fontWeight: active ? 650 : 500, color }}>{label}</span>
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
        background: "var(--coral-deep)",
        color: "#fff",
        fontSize: 11,
        fontWeight: 700,
        boxShadow: "0 0 0 2px #fff",
      }}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}
