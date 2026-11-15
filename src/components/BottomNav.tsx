import { ChatsGlyph, DropGlyph, FeedGlyph, GamesGlyph, TableGlyph } from "@/components/Brand";
import { Link, useLocation } from "@tanstack/react-router";
import { useSocial } from "@/lib/social";
import { buzz } from "@/components/SocialUI";
import { useDropBadge } from "@/lib/dropBadge";

const tabs = [
  { to: "/app/home", label: "Table", Icon: TableGlyph },
  { to: "/app/feed", label: "Scenes", Icon: FeedGlyph },
  { to: "/app/drop", label: "Drop", Icon: DropGlyph },
  { to: "/app/chats", label: "Chats", Icon: ChatsGlyph },
  { to: "/app/games", label: "Games", Icon: GamesGlyph },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  const social = useSocial();
  const unread = Object.values(social.unread).reduce((a, b) => a + b, 0);
  // The Drop tab: a lime dot at Drop time, a pulse once you've missed it.
  const drop = useDropBadge(pathname);

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 z-40 px-3 pointer-events-none"
      style={{ bottom: "max(0.75rem, calc(env(safe-area-inset-bottom) - 0.5rem))" }}
    >
      <ul className="lg relative pointer-events-auto mx-auto max-w-[420px] grid grid-cols-5 items-end px-1 pb-0.5 rounded-[26px]">
        {tabs.map(({ to, label, Icon }) => {
          const active =
            pathname.startsWith(to) ||
            (to === "/app/home" &&
              (pathname.startsWith("/app/people") || pathname.startsWith("/app/seat")));
          const badge = to === "/app/chats" ? unread : 0;
          const dropDot = to === "/app/drop" && !active ? drop : null;
          const color = active ? "var(--lime)" : "var(--ink-2)";
          return (
            <li key={to}>
              <Link
                to={to}
                aria-label={
                  badge
                    ? `${label}, ${badge} new`
                    : dropDot === "now"
                      ? `${label}, it's Drop time`
                      : dropDot === "missed"
                        ? `${label}, you missed it, post late`
                        : label
                }
                aria-current={active ? "page" : undefined}
                onClick={() => buzz(8)}
                className="flex flex-col items-center justify-end gap-0.5 pt-1.5 pb-1 min-h-[56px]"
              >
                <span
                  className={`relative flex items-center justify-center w-12 h-8 rounded-xl ${dropDot ? "pulse-lime" : ""}`}
                  style={{
                    background: active ? "rgba(193, 239, 98, 0.14)" : "transparent",
                    color,
                    transition: "background-color 180ms var(--ease), color 180ms var(--ease)",
                  }}
                >
                  <Icon size={22} active={active} />
                  {badge > 0 && <Badge n={badge} />}
                  {dropDot && (
                    <span
                      aria-hidden="true"
                      className="pop absolute -top-0.5 right-1.5 w-2.5 h-2.5 rounded-full"
                      style={{
                        background: "var(--lime)",
                        boxShadow: "0 0 10px rgba(193,239,98,0.8)",
                        border: "2px solid var(--surface)",
                      }}
                    />
                  )}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: active ? 700 : 600, color }}>
                  {label}
                </span>
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
