import { Link, useLocation } from "@tanstack/react-router";
import { Camera, Circle, Gamepad2, LayoutGrid, MessageCircle } from "lucide-react";
import { useSocial } from "@/lib/social";
import { buzz } from "@/components/SocialUI";

const tabs = [
  { to: "/app/home", label: "Table", Icon: Circle },
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
      className="fixed bottom-0 inset-x-0 z-40 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      style={{
        background: "rgba(255,255,255,0.94)",
        backdropFilter: "blur(18px) saturate(160%)",
        WebkitBackdropFilter: "blur(18px) saturate(160%)",
        borderTop: "1px solid var(--border-cool)",
        boxShadow: "0 -8px 30px -18px rgba(14,42,69,0.35)",
      }}
    >
      <div className="mx-auto max-w-md grid grid-cols-5 items-end px-2 pt-1.5">
        {tabs.map(({ to, label, Icon }) => {
          const active =
            pathname.startsWith(to) || (to === "/app/feed" && pathname.startsWith("/app/reels"));
          const badge = to === "/app/chats" ? unread : to === "/app/snap" ? newSnaps : 0;
          const isSnap = to === "/app/snap";

          if (isSnap) {
            return (
              <Link
                key={to}
                to={to}
                search={{ to: undefined }}
                aria-label={label}
                onClick={() => buzz()}
                className="flex flex-col items-center -mt-6"
              >
                <span
                  className="relative w-[60px] h-[60px] rounded-full flex items-center justify-center"
                  style={{
                    background: active ? "var(--navy)" : "var(--blue)",
                    color: "#fff",
                    boxShadow: "0 0 0 5px #fff, var(--shadow-pop)",
                  }}
                >
                  <Camera size={26} strokeWidth={2.2} />
                  {badge > 0 && <Badge n={badge} />}
                </span>
                <span
                  className="mt-1 font-semibold"
                  style={{
                    fontSize: 10.5,
                    color: active ? "var(--blue-deep)" : "var(--text-muted)",
                  }}
                >
                  {label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={to}
              to={to}
              aria-label={label}
              onClick={() => buzz(8)}
              className="flex flex-col items-center justify-center py-1"
            >
              <span
                className="relative flex items-center justify-center rounded-full"
                style={{
                  width: 52,
                  height: 32,
                  background: active ? "var(--sky-100)" : "transparent",
                  color: active ? "var(--blue-deep)" : "var(--text-muted)",
                  transition: "background-color 260ms var(--spring), color 200ms",
                }}
              >
                <Icon size={21} strokeWidth={active ? 2.4 : 1.8} />
                {badge > 0 && <Badge n={badge} />}
              </span>
              <span
                className="mt-0.5"
                style={{
                  fontSize: 10.5,
                  fontWeight: active ? 700 : 500,
                  color: active ? "var(--blue-deep)" : "var(--text-muted)",
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span
      key={n}
      className="pop absolute -top-1 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center tabular-nums"
      style={{
        background: "var(--coral-deep)",
        color: "#fff",
        fontSize: 10,
        fontWeight: 700,
        boxShadow: "0 0 0 2px #fff",
      }}
    >
      {n}
    </span>
  );
}
