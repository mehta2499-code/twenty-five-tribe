import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { Toast } from "@/components/SocialUI";
import { initLive } from "@/lib/live";
import { clearError, clearNotice, useSocial } from "@/lib/social";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const s = useSocial();

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

  // Wait until we know you're signed in and your real 25 has loaded.
  if (!signedIn || s.mode !== "live")
    return <div className="min-h-screen bg-background" aria-busy="true" />;

  return (
    <div className="min-h-screen bg-background relative">
      <div key={pathname} className="mx-auto max-w-md pb-28 relative page-in app-column">
        <Outlet />
      </div>
      <BottomNav />
      {s.error && <Toast text={s.error} onDone={() => clearError()} />}
      {!s.error && s.notice && <Toast text={s.notice} onDone={() => clearNotice()} />}
    </div>
  );
}
