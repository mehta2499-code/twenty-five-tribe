import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { InAppBanner } from "@/components/InAppBanner";
import { AnimatedLogo } from "@/components/Logo";
import { Toast } from "@/components/SocialUI";
import { initLive } from "@/lib/live";
import { syncPush } from "@/lib/push";
import { clearError, clearNotice, useSocial } from "@/lib/social";

let introShown = false;

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const s = useSocial();

  // Tab change: the page settles in with a short slide (no fade, no remount, so no flash).
  const columnRef = useRef<HTMLDivElement>(null);
  /** 1 = came from a swipe left (next tab), -1 = swipe right. */
  const swipeDir = useRef(0);
  const tab = pathname.split("/")[2] ?? "";

  // Swipe between the five tabs (like pages). Left = next tab, right = previous.
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);
  const TAB_ORDER = ["home", "feed", "snap", "chats", "games"];
  const onSwipeStart = (e: React.TouchEvent) => {
    swipe.current = null;
    const onTab = pathname === `/app/${tab}` && TAB_ORDER.includes(tab);
    if (!onTab || e.touches.length !== 1) return;
    const el = e.target as HTMLElement;
    // Not inside overlays, games, text boxes, or anything that scrolls sideways.
    if (el.closest(".fixed, [role=dialog], [data-noswipe], input, textarea, video, canvas")) return;
    for (let n: HTMLElement | null = el; n && n !== e.currentTarget; n = n.parentElement) {
      const ox = getComputedStyle(n).overflowX;
      if ((ox === "auto" || ox === "scroll") && n.scrollWidth > n.clientWidth) return;
    }
    const t = e.touches[0];
    swipe.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onSwipeEnd = (e: React.TouchEvent) => {
    const s0 = swipe.current;
    swipe.current = null;
    if (!s0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s0.x;
    const dy = t.clientY - s0.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2 || Date.now() - s0.t > 700) return;
    const i = TAB_ORDER.indexOf(tab) + (dx < 0 ? 1 : -1);
    if (i < 0 || i >= TAB_ORDER.length) return;
    const to = `/app/${TAB_ORDER[i]}` as const;
    swipeDir.current = dx < 0 ? 1 : -1;
    navigate({ to: to as "/app/home", ...(to === "/app/snap" ? { search: { to: undefined } } : {}) } as never);
  };
  const firstTab = useRef(true);
  useEffect(() => {
    if (firstTab.current) {
      firstTab.current = false;
      return;
    }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const dir = swipeDir.current;
    swipeDir.current = 0;
    columnRef.current?.animate(
      dir
        ? [{ transform: `translateX(${dir * 28}px)`, opacity: 0.6 }, { transform: "none", opacity: 1 }]
        : [{ transform: "translateY(6px)" }, { transform: "none" }],
      { duration: 200, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" },
    );
  }, [tab]);

  // The app is for signed-in people only: no demo friends. Not signed in → sign-in screen.
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    initLive();
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (data.session) setSignedIn(true);
      else navigate({ to: "/login", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate({ to: "/login", replace: true });
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  // Service worker: caches the app's built files on the phone for a fast start.
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  // While the app is open and visible, tell the server we're here so it holds
  // back push notifications (the in-app banner covers it).
  useEffect(() => {
    if (s.mode !== "live" || !s.me) return;
    const ping = (active: boolean) =>
      void supabase.rpc("set_active", { p_active: active }).then(() => undefined);
    const beat = () => document.visibilityState === "visible" && ping(true);
    beat();
    const t = setInterval(beat, 30_000);
    const onVis = () => ping(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", () => ping(false));
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [s.mode, s.me?.id]);

  // Notifications already allowed on this device: keep it registered.
  useEffect(() => {
    if (s.mode === "live" && s.me) void syncPush();
  }, [s.mode, s.me?.id]);

  // Signed in but no name yet: finish setting up first.
  useEffect(() => {
    if (s.mode === "live" && s.needsProfile) navigate({ to: "/login" });
    else if (s.mode === "live" && s.me && !s.me.vibeDone && !s.loading) navigate({ to: "/vibe" });
  }, [s.mode, s.needsProfile, s.me, s.loading, navigate]);

  useEffect(() => {
    if (!signedIn) return;
    try {
      const done = localStorage.getItem("tf.walkthrough.done");
      if (!done) navigate({ to: "/walkthrough" });
    } catch {}

    // Privacy: optionally blur on tab hide (best-effort screenshot deterrent)
    const allow = (() => {
      try {
        return localStorage.getItem("tf.privacy.allowScreenshots") === "1";
      } catch {
        return true;
      }
    })();
    if (allow) return;

    const onHide = () => {
      if (document.visibilityState === "hidden") {
        document.documentElement.classList.add("privacy-blur");
      } else {
        document.documentElement.classList.remove("privacy-blur");
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [navigate, signedIn]);

  // Let the opening logo finish drawing (once per launch).
  const [intro, setIntro] = useState(!introShown);
  useEffect(() => {
    if (!intro) return;
    const t = setTimeout(() => {
      introShown = true;
      setIntro(false);
    }, 2300);
    return () => clearTimeout(t);
  }, [intro]);

  // Wait until we know you're signed in and your real 25 has loaded, so the
  // screen never shows placeholder people first.
  if (intro || !signedIn || s.mode !== "live" || s.loading || (!s.me && !s.needsProfile))
    return (
      <div
        className="bg-background flex items-center justify-center"
        style={{ minHeight: "100dvh" }}
        aria-busy="true"
        aria-label="Loading your 25"
      >
        <div className="flex flex-col items-center px-8 text-center">
          <AnimatedLogo height={230} />
          <p className="tagline-in display mt-6" style={{ fontSize: 26, letterSpacing: "-0.01em" }}>
            Everyone else is noise.
          </p>
          {!s.loading && s.error && (
            <>
              <p className="text-cool text-sm mt-6">{s.error}</p>
              <button onClick={() => window.location.reload()} className="btn-primary px-5">
                Try again
              </button>
            </>
          )}
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-background relative">
      <div
        ref={columnRef}
        className="mx-auto max-w-md pb-32 relative app-column"
        onTouchStart={onSwipeStart}
        onTouchEnd={onSwipeEnd}
      >
        <Outlet />
      </div>
      <BottomNav />
      <InAppBanner />
      {s.error && <Toast text={s.error} onDone={() => clearError()} />}
      {!s.error && s.notice && <Toast text={s.notice} onDone={() => clearNotice()} />}
    </div>
  );
}
