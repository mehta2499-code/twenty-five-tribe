import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    try {
      const done = localStorage.getItem("tf.walkthrough.done");
      if (!done) navigate({ to: "/walkthrough" });
    } catch {}

    // Privacy: optionally blur on tab hide (best-effort screenshot deterrent)
    const allow = (() => {
      try { return localStorage.getItem("tf.privacy.allowScreenshots") === "1"; } catch { return true; }
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
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background relative">
      <div key={pathname} className="mx-auto max-w-md pb-28 relative page-in">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
