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
        background: "rgba(11,10,15,0.9)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
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
          const color = active ? "var(--accent)" : "var(--ink-3)";
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
                    className="relative -mt-6 w-[58px] h-[58px] rounded-full flex items-center justify-center"
                    style={{
                      background: "linear-gradient(180deg, #E3C385 0%, #CFA95F 100%)",
                      color: "var(--on-accent)",
                      boxShadow: active
                        ? "0 0 0 2px var(--page), 0 0 0 3.5px var(--accent)"
                        : "var(--shadow-pop)",
                    }}
                  >
                    <Camera size={26} strokeWidth={2.4} />
                    {badge > 0 && <Badge n={badge} />}
                  </span>
                ) : (
                  <span
                    className="relative flex items-center justify-center w-12 h-8 rounded-xl"
                    style={{
                      background: active ? "var(--fill-2)" : "transparent",
                      border: "1px solid transparent",
                      color,
                    }}
                  >
                    <Icon size={21} strokeWidth={active ? 2.5 : 2} />
                    {badge > 0 && <Badge n={badge} />}
                  </span>
                )}
                <span style={{ fontSize: 12, fontWeight: active ? 800 : 600, color }}>{label}</span>
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
        background: "var(--hot)",
        color: "#fff",
        fontSize: 11,
        fontWeight: 800,
        border: "1px solid var(--line-2)",
      }}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}
