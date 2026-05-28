import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="min-h-screen bg-background relative">
      {/* subtle top fade behind headers */}
      <div className="pointer-events-none fixed top-0 inset-x-0 h-24 z-10 header-fade" />
      <div className="mx-auto max-w-md pb-28 relative">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
