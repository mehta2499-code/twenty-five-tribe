import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ImagePlus } from "lucide-react";
import { account, initLive } from "@/lib/live";
import { fileToImage, useSocial } from "@/lib/social";
import { clientOnly } from "@/components/SocialUI";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in · 25" }] }),
  component: clientOnly(Login),
});

type Step = "email" | "code" | "profile";

function Login() {
  const s = useSocial();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => initLive(), []);

  // Signed in (by code, or by tapping the email link): pick a name, or go in.
  useEffect(() => {
    if (s.mode !== "live" || s.loading) return;
    if (s.needsProfile) setStep("profile");
    else if (s.me && !s.me.vibeDone) navigate({ to: "/vibe" });
    else if (s.me) {
      let invite: string | null = null;
      try {
        invite = localStorage.getItem("tf.pendingInvite");
        localStorage.removeItem("tf.pendingInvite");
      } catch {
        // ignore
      }
      if (invite) navigate({ to: "/in/$username", params: { username: invite } });
      else navigate({ to: "/app/home" });
    }
  }, [s.mode, s.loading, s.needsProfile, s.me, navigate]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    act(async () => {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error("Enter a valid email address.");
      await account.sendCode(email);
      setStep("code");
      setResendIn(45);
    });

  const field = "input";
  const primary = "btn-primary w-full";

  return (
    <main
      className="min-h-screen text-white flex flex-col px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      style={{
        background:
          "radial-gradient(700px 420px at 50% -10%, rgba(181,219,94,0.18), transparent 65%), #0B0A0F",
      }}
    >
      <div className="mx-auto w-full max-w-sm flex-1 flex flex-col">
        <div className="flex items-center justify-between h-10">
          {step === "code" ? (
            <button onClick={() => setStep("email")} aria-label="Back" className="p-1 -ml-1">
              <ArrowLeft size={22} />
            </button>
          ) : (
            <span />
          )}
          <Link
            to="/app/home"
            className="text-sm font-semibold text-white/90 underline underline-offset-4"
          >
            Try the demo
          </Link>
        </div>

        <h1 className="mt-10">
          <Logo height={120} />
        </h1>

        {step === "email" && (
          <form
            className="mt-8 flex flex-col gap-4 animate-soft-in"
            onSubmit={(e) => {
              e.preventDefault();
              void sendCode();
            }}
          >
            <p className="display" style={{ fontSize: 26, fontStyle: "italic", fontWeight: 500 }}>
              Claim your seat.
            </p>
            <p className="text-white/85" style={{ fontSize: 15, lineHeight: 1.5 }}>
              We'll email you a 6-digit code. No passwords.
            </p>
            <label htmlFor="login-email" className="sr-only">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
            />
            <button type="submit" disabled={busy || !email} className={primary}>
              {busy ? "Sending…" : "Send my code"}
            </button>
          </form>
        )}

        {step === "code" && (
          <form
            className="mt-8 flex flex-col gap-4 animate-soft-in"
            onSubmit={(e) => {
              e.preventDefault();
              void act(() => account.verifyCode(email, code));
            }}
          >
            <p className="display" style={{ fontSize: 26, fontStyle: "italic", fontWeight: 500 }}>
              Check your email.
            </p>
            <p className="text-cool" style={{ fontSize: 15, lineHeight: 1.5 }}>
              Enter the 6-digit code we sent to{" "}
              <span className="font-semibold text-cream">{email}</span>.
            </p>
            <label htmlFor="login-code" className="sr-only">
              6-digit code
            </label>
            <input
              id="login-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              placeholder="123456"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={`${field} text-center tracking-[0.5em] text-2xl font-bold`}
            />
            <button type="submit" disabled={busy || code.length < 6} className={primary}>
              {busy ? "Checking…" : "Sign in"}
            </button>
            <p className="text-center text-sm text-faint">
              Or tap <span className="font-semibold text-cream">Sign in to 25</span> in the email.
              Nothing yet? Check spam.
            </p>
            <button
              type="button"
              disabled={resendIn > 0 || busy}
              onClick={() => void sendCode()}
              className="text-sm font-semibold text-white/90 disabled:text-white/60"
            >
              {resendIn > 0 ? `Send a new code in ${resendIn}s` : "Send a new code"}
            </button>
          </form>
        )}

        {step === "profile" && (
          <form
            className="mt-8 flex flex-col gap-4 animate-soft-in"
            onSubmit={(e) => {
              e.preventDefault();
              void act(() =>
                account.createProfile({ name, username, avatar: avatar ?? undefined }),
              );
            }}
          >
            <p className="display" style={{ fontSize: 26, fontStyle: "italic", fontWeight: 500 }}>
              Who's sitting down?
            </p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Add a profile photo"
                className="w-20 h-20 shrink-0 rounded-full overflow-hidden flex items-center justify-center bg-white/20 border-2 border-white/60"
              >
                {avatar ? (
                  <img src={avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus size={24} />
                )}
              </button>
              <p className="text-white/85 text-sm">
                Add a photo so your people recognise you. Optional.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setAvatar(await fileToImage(f, 600));
                }}
              />
            </div>
            <label htmlFor="login-name" className="text-sm font-semibold">
              Your name
            </label>
            <input
              id="login-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 40))}
              placeholder="Ananya Shah"
              className={field}
            />
            <label htmlFor="login-username" className="text-sm font-semibold">
              Username <span className="font-normal text-white/80">(how friends find you)</span>
            </label>
            <input
              id="login-username"
              value={username}
              onChange={(e) =>
                setUsername(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9_.]/g, "")
                    .slice(0, 20),
                )
              }
              placeholder="ananya.s"
              autoCapitalize="none"
              className={field}
            />
            <button
              type="submit"
              disabled={busy || !name.trim() || username.length < 3}
              className={primary}
            >
              {busy ? "Saving…" : "Pull up a chair"}
            </button>
          </form>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-2xl px-4 py-3 bg-[rgba(214,62,98,0.12)] text-[#F08AA3] border border-[rgba(214,62,98,0.35)] font-semibold text-sm"
          >
            {error}
          </p>
        )}

        <p className="mt-auto pt-10 text-center text-white/80 text-xs">
          25 seats. No more, no less.
        </p>
      </div>
    </main>
  );
}
