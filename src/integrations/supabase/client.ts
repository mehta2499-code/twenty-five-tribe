import { createClient } from "@supabase/supabase-js";

// Public project URL and anon key. These are meant to ship in the app;
// row level security in supabase/migrations decides what each person can see.
// Never put the service_role key here.
const SUPABASE_URL = "https://yhtuvujroxdcsstbpipt.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlodHV2dWpyb3hkY3NzdGJwaXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3ODcxNTEsImV4cCI6MjEwOTM2MzE1MX0.34abEvy75YDiLR0wkDnNQegbVGYspN2y9h66SqRM6f4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
