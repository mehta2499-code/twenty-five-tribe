import { createClient } from "@supabase/supabase-js";

// Public project URL and anon key. These are meant to ship in the app;
// row level security in supabase/migrations decides what each person can see.
// Never put the service_role key here.
export const SUPABASE_URL = "https://yhtuvujroxdcsstbpipt.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlodHV2dWpyb3hkY3NzdGJwaXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3ODcxNTEsImV4cCI6MjEwOTM2MzE1MX0.34abEvy75YDiLR0wkDnNQegbVGYspN2y9h66SqRM6f4";

/**
 * Where the sign-in is kept. Some places block saved data (Lovable's preview
 * window, private browsing, in-app browsers); there we fall back to memory so
 * sign-up still works until the page is closed.
 */
const memory = new Map<string, string>();
const safeStorage = {
  getItem(key: string) {
    try {
      return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  },
  setItem(key: string, value: string) {
    memory.set(key, value);
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Blocked: memory copy is enough for this visit.
    }
  },
  removeItem(key: string) {
    memory.delete(key);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Links from the email work even if they open in a different browser.
    flowType: "implicit",
    storage: typeof window !== "undefined" ? safeStorage : undefined,
  },
});
