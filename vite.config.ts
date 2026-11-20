// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
// One id per build, baked into both the app and the server, so a phone still
// running an old copy can tell a new version is out (and reload).
const BUILD_ID = String(Date.now());

export default defineConfig({
  vite: { define: { __BUILD_ID__: JSON.stringify(BUILD_ID) } },
  tanstackStart: {
    server: { entry: "server" },
  },
});
