import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { clientOnly } from "@/components/SocialUI";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password · 25" },
      { name: "description", content: "Securely choose a new password for your Twenty Five account." },
      { property: "og:title", content: "A fresh key for your seat · 25" },
      { property: "og:description", content: "Choose a new password for your Twenty Five account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: clientOnly(ResetPassword),
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setNotice("Your secure link is ready. Choose a new password below.");
    });
    if (window.location.hash.includes("type=recovery") || new URLSearchParams(window.location.search).has("code")) {
      setNotice("Your secure link is ready. Choose a new password below.");
    }
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (password.length < 8 || password.length > 128) {
      setError("Use a password between 8 and 128 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don’t match yet.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setNotice("Password updated. Your seat is right where you left it.");
      setPassword("");
      setConfirm("");
      window.history.replaceState(null, "", "/reset-password");
      window.setTimeout(() => navigate({ to: "/app/home", replace: true }), 700);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "That reset link may have expired.";
      setError(/expired|invalid|session/i.test(message)
        ? "That reset link has expired or was already used. Request a fresh one and try again."
        : message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      className="min-h-screen text-white flex flex-col px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      style={{ background: "radial-gradient(700px 420px at 50% -10%, rgba(181,219,94,0.18), transparent 65%), #0B0A0F" }}
    >
      <div className="mx-auto w-full max-w-sm flex-1 flex flex-col">
        <div className="flex items-center justify-between h-10">
          <span />
          <Link to="/" className="text-sm font-semibold text-white/90 underline underline-offset-4">What’s 25?</Link>
        </div>
        <h1 className="mt-10"><Logo height={120} /></h1>
        <form className="mt-8 flex flex-col gap-4 animate-soft-in" onSubmit={(event) => void submit(event)}>
          <p className="display" style={{ fontSize: 26, fontStyle: "italic", fontWeight: 500 }}>Choose a new password.</p>
          <p className="text-white/85" style={{ fontSize: 15, lineHeight: 1.5 }}>Make it yours, then head back to your people.</p>
          <Input aria-label="New password" type="password" autoComplete="new-password" placeholder="New password (8+ characters)" value={password} onChange={(event) => setPassword(event.target.value.slice(0, 128))} className="input" minLength={8} required />
          <Input aria-label="Confirm new password" type="password" autoComplete="new-password" placeholder="Confirm new password" value={confirm} onChange={(event) => setConfirm(event.target.value.slice(0, 128))} className="input" minLength={8} required />
          <Button type="submit" disabled={busy || password.length < 8 || password !== confirm} className="btn-primary w-full">
            {busy ? "Saving…" : "Save new password"}
          </Button>
        </form>
        {notice && <p role="status" className="mt-4 rounded-2xl px-4 py-3 bg-white/10 text-white border border-white/20 text-sm">{notice}</p>}
        {error && <p role="alert" className="mt-4 rounded-2xl px-4 py-3 bg-[rgba(214,62,98,0.12)] text-[#F08AA3] border border-[rgba(214,62,98,0.35)] font-semibold text-sm">{error}</p>}
        <Link to="/login" className="mt-5 text-center text-sm text-white/80 underline underline-offset-4">Back to sign in</Link>
        <p className="mt-auto pt-10 text-center text-white/80 text-xs">25 seats. No more, no less.</p>
      </div>
    </main>
  );
}