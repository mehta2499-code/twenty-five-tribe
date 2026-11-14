/** Slide-down banner for new messages and snaps while you're in the app. */
import { useEffect } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Avatar } from "@/components/Avatar";
import { buzz } from "@/components/SocialUI";
import { clearBanner, useSocial } from "@/lib/social";

export function InAppBanner() {
  const s = useSocial();
  const b = s.banner;
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Already looking at that chat: no banner.
  const here = !!b && pathname === b.to;

  useEffect(() => {
    if (!b) return;
    if (here) {
      clearBanner(b.id);
      return;
    }
    buzz(12);
    const t = setTimeout(() => clearBanner(b.id), 4000);
    return () => clearTimeout(t);
  }, [b?.id, here]);

  if (!b || here) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[85] flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pointer-events-none">
      <button
        key={b.id}
        onClick={() => {
          clearBanner(b.id);
          b.onOpen?.();
          navigate({ to: b.to as "/app/home" });
        }}
        className="pointer-events-auto w-full max-w-md flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left banner-in"
        style={{
          background: "var(--surface)",
          border: "var(--bd)",
          boxShadow: "var(--pop), 0 12px 30px rgba(0,0,0,0.5)",
        }}
      >
        <Avatar src={b.avatar} initials={b.initials} color={b.color} size={40} />
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-cream truncate">{b.title}</span>
          <span className="block meta truncate" style={{ fontSize: 13.5 }}>
            {b.body}
          </span>
        </span>
        <span className="meta shrink-0" style={{ fontSize: 12 }}>
          now
        </span>
      </button>
    </div>
  );
}
