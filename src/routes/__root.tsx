import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import { useEffect } from "react";
import { trackAppOpen } from "@/lib/track";
import appCss from "../styles.css?url";

export function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#3B3F34" },
      // "Add to Home Screen" on iPhone: open full screen, like an app.
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "25" },
      // Solid status bar: with "translucent", newer iOS blurs whatever scrolls under it.
      { name: "apple-mobile-web-app-status-bar-style", content: "black" },
      { title: "25 — Everyone else is noise." },
      {
        name: "description",
        content: "Everyone else is noise. A social app for your 25 closest people.",
      },
      { property: "og:title", content: "25 — Everyone else is noise." },
      {
        property: "og:description",
        content: "Everyone else is noise. A social app for your 25 closest people.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "25 — Everyone else is noise." },
      {
        name: "twitter:description",
        content: "Everyone else is noise. A social app for your 25 closest people.",
      },
      {
        property: "og:image",
        content:
          "https://the25.world/og.png",
      },
      {
        name: "twitter:image",
        content:
          "https://the25.world/og.png",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [
      {
        // Runs before the page is drawn: on the landing page, if this is the
        // Home Screen app or you're already signed in, go straight into the
        // app so the landing page never flashes.
        children: `(function(){try{if(location.pathname!=="/")return;var s=!!window.Capacitor||window.matchMedia&&matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;var t=localStorage.getItem("sb-yhtuvujroxdcsstbpipt-auth-token");if(s||t){document.documentElement.style.visibility="hidden";location.replace("/app/home");}}catch(e){}})();`,
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Cabin+Sketch:wght@700&family=Gochi+Hand&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // Analytics: one app_open per visit (landing page included) + install listener.
  useEffect(() => trackAppOpen(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
