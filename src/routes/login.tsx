import { takePendingPath } from "@/lib/pending";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ImagePlus } from "lucide-react";
import { account, initLive } from "@/lib/live";
import { fileToImage, useSocial } from "@/lib/social";
import { clientOnly } from "@/components/SocialUI";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in or join · 25" },
      {
        name: "description",
        content: "Sign in to Twenty Five or claim a seat for your closest people.",
      },
      { property: "og:title", content: "Your seat at 25" },
      {
        property: "og:description",
        content: "A private little corner for the people who matter most.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: clientOnly(Login),
});

type Step = "email" | "code" | "profile" | "forgot" | "reset";

function Login() {
  const s = useSocial();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [isSignup, setIsSignup] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** True once the password was chosen at sign-up, so the profile step doesn't ask again. */
  const [passwordSet, setPasswordSet] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => initLive(), []);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setStep("reset");
      return;
    }
    if (hash.includes("access_token=") && hash.includes("type=signup")) {
      setIsSignup(true);
      setNotice("Email verified. Pick your username, password, and photo to finish.");
      setStep("profile");
    }
  }, []);

  // A verified signup may create a session; existing profiles continue straight into the app.
  useEffect(() => {
    if (s.mode !== "live" || s.loading || step === "reset") return;
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
      const pending = takePendingPath();
      if (invite) navigate({ to: "/in/$username", params: { username: invite } });
      else if (pending) navigate({ to: pending as "/app/home" });
      else navigate({ to: "/app/home" });
    }
  }, [s.mode, s.loading, s.needsProfile, s.me, navigate, step]);

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
      const normalizedEmail = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error("Enter a valid email address.");
      if (isSignup) await account.resendSignupCode(normalizedEmail);
      else await account.sendCode(normalizedEmail);
      setNotice("We sent a new code. Check your inbox and spam folder.");
      setStep("code");
      setResendIn(45);
    });

  const submitEmail = () =>
    act(async () => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error("Enter a valid email address.");
      if (isSignup) {
        if (password.length < 8) throw new Error("Use at least 8 characters for your password.");
        if (password !== confirmPassword) throw new Error("Those passwords don’t match yet.");
        const { needsCode } = await account.signUp(normalizedEmail, password);
        setPasswordSet(true);
        if (needsCode) {
          setCode("");
          setNotice("We emailed you a 6-digit code. Enter it to claim your seat.");
          setStep("code");
          setResendIn(45);
          return;
        }
        setNotice(null);
        setStep("profile");
        await initLive();
        return;
      }
      if (!password) throw new Error("Enter your password.");
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error)
        throw new Error(
          /invalid login credentials/i.test(error.message)
            ? "That email and password don’t match. Check them or reset your password."
            : error.message,
        );
      await initLive();
    });

  const sendReset = () =>
    act(async () => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(normalizedEmail))
        throw new Error("Enter the email address on your account.");
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw new Error(error.message);
      setResetSent(true);
      setNotice(
        "If an account uses that email, a password reset link is on its way. Check your inbox and spam folder.",
      );
    });

  const saveNewPassword = () =>
    act(async () => {
      if (password.length < 8) throw new Error("Use at least 8 characters for your password.");
      if (password !== confirmPassword) throw new Error("Those passwords don’t match yet.");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);
      setNotice("Password updated. You’re all set.");
      setPassword("");
      setConfirmPassword("");
      setStep("email");
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
          {step !== "email" ? (
            <button
              onClick={() => {
                setStep("email");
                setError(null);
              }}
              aria-label="Back"
              className="p-1 -ml-1"
            >
              <ArrowLeft size={22} />
            </button>
          ) : (
            <span />
          )}
          <Link to="/" className="text-sm font-semibold text-white/90 underline underline-offset-4">
            What's 25?
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
              void submitEmail();
            }}
          >
            <p className="chalk-title" style={{ fontSize: 40 }}>
              Claim your <span className="chalk-lime chalk-underline">seat.</span>
            </p>
            <p className="text-white/85" style={{ fontSize: 15, lineHeight: 1.5 }}>
              {isSignup
                ? "A little corner of the internet, just for your people."
                : "Your people are right where you left them."}
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
            <label htmlFor="account-password" className="sr-only">
              Password
            </label>
            <Input
              id="account-password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder={isSignup ? "Create a password (8+ characters)" : "Password"}
              value={password}
              onChange={(e) => setPassword(e.target.value.slice(0, 128))}
              className={field}
              required
            />
            {isSignup && (
              <Input
                aria-label="Confirm password"
                type="password"
                autoComplete="new-password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value.slice(0, 128))}
                className={field}
                required
              />
            )}
            <button
              type="submit"
              disabled={
                busy ||
                !email ||
                (isSignup ? password.length < 8 || password !== confirmPassword : !password)
              }
              className={primary}
            >
              {busy
                ? isSignup
                  ? "Creating your seat…"
                  : "Signing in…"
                : isSignup
                  ? "Create account"
                  : "Sign in"}
            </button>
            {!isSignup && (
              <button
                type="button"
                onClick={() => {
                  setStep("forgot");
                  setError(null);
                  setResetSent(false);
                }}
                className="text-sm text-white/80 underline underline-offset-4"
              >
                Forgot password?
              </button>
            )}
            <p className="text-center text-sm text-white/80">
              {isSignup ? "Already have a seat?" : "New around here?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsSignup(!isSignup);
                  setPassword("");
                  setConfirmPassword("");
                  setError(null);
                  setNotice(null);
                }}
                className="font-semibold text-white underline underline-offset-4"
              >
                {isSignup ? "Sign in" : "Create an account"}
              </button>
            </p>
          </form>
        )}

        {step === "code" && (
          <form
            className="mt-8 flex flex-col gap-4 animate-soft-in"
            onSubmit={(e) => {
              e.preventDefault();
              void act(async () => {
                await account.verifyCode(email, code);
                setNotice(
                  passwordSet
                    ? "Email verified. Now choose your name, username and photo."
                    : "Email verified. Now choose your username, password, and photo.",
                );
                setStep("profile");
                await initLive();
              });
            }}
          >
            <p className="chalk-title" style={{ fontSize: 34 }}>
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
              {busy ? "Checking…" : "Verify email"}
            </button>
            <p className="text-center text-sm text-faint">
              {isSignup
                ? "New codes can take a minute. Check spam too."
                : "Nothing yet? Check spam, or request a fresh code."}
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
                account.createProfile({
                  name,
                  username,
                  avatar: avatar ?? undefined,
                  ...(passwordSet ? {} : { password, confirmPassword }),
                }),
              );
            }}
          >
            <p className="chalk-title" style={{ fontSize: 34 }}>
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
                  <img
                    loading="lazy"
                    decoding="async"
                    src={avatar}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImagePlus size={24} />
                )}
              </button>
              <p className="text-white/85 text-sm">
                Add a photo so your people recognise you. Required to save your seat.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  if (!/^(image\/(jpeg|png|webp|gif|bmp|avif))$/.test(f.type)) {
                    setError("Choose a JPG, PNG, WebP, GIF, BMP, or AVIF photo.");
                    return;
                  }
                  if (f.size > 5 * 1024 * 1024) {
                    setError("Choose a photo smaller than 5 MB.");
                    return;
                  }
                  try {
                    setError(null);
                    setAvatar(await fileToImage(f, 600));
                  } catch {
                    setError("That photo couldn’t be opened. Try a different image.");
                  }
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
            {!passwordSet && (
              <>
                <label htmlFor="new-password" className="text-sm font-semibold">
                  Create a password
                </label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value.slice(0, 128))}
                  className={field}
                  minLength={8}
                  required
                />
                <Input
                  aria-label="Confirm password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value.slice(0, 128))}
                  className={field}
                  minLength={8}
                  required
                />
              </>
            )}
            <button
              type="submit"
              disabled={
                busy ||
                s.mode !== "live" ||
                s.loading ||
                !name.trim() ||
                username.length < 3 ||
                !avatar ||
                (!passwordSet && (password.length < 8 || password !== confirmPassword))
              }
              className={primary}
            >
              {busy ? "Saving…" : "Pull up a chair"}
            </button>
          </form>
        )}

        {step === "forgot" && (
          <form
            className="mt-8 flex flex-col gap-4 animate-soft-in"
            onSubmit={(e) => {
              e.preventDefault();
              void sendReset();
            }}
          >
            <p className="chalk-title" style={{ fontSize: 34 }}>
              A fresh key for your seat.
            </p>
            <p className="text-white/85" style={{ fontSize: 15, lineHeight: 1.5 }}>
              Enter your email and we’ll send a secure password reset link.
            </p>
            <Input
              aria-label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
              required
            />
            <button type="submit" disabled={busy || resetSent} className={primary}>
              {busy ? "Sending…" : resetSent ? "Link sent" : "Send reset link"}
            </button>
          </form>
        )}

        {step === "reset" && (
          <form
            className="mt-8 flex flex-col gap-4 animate-soft-in"
            onSubmit={(e) => {
              e.preventDefault();
              void saveNewPassword();
            }}
          >
            <p className="chalk-title" style={{ fontSize: 34 }}>
              Choose a new password.
            </p>
            <Input
              aria-label="New password"
              type="password"
              autoComplete="new-password"
              placeholder="New password (8+ characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value.slice(0, 128))}
              className={field}
              minLength={8}
              required
            />
            <Input
              aria-label="Confirm new password"
              type="password"
              autoComplete="new-password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value.slice(0, 128))}
              className={field}
              minLength={8}
              required
            />
            <button
              type="submit"
              disabled={busy || password.length < 8 || password !== confirmPassword}
              className={primary}
            >
              {busy ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}

        {notice && (
          <p
            role="status"
            className="mt-4 rounded-2xl px-4 py-3 bg-white/10 text-white border border-white/20 text-sm"
          >
            {notice}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-2xl px-4 py-3 bg-[rgba(214,62,98,0.12)] text-[#F08AA3] border border-[rgba(214,62,98,0.35)] font-semibold text-sm"
          >
            {error}
          </p>
        )}

        <p className="mt-auto pt-10 text-center text-white/80 text-xs">Everyone else is noise.</p>
      </div>
    </main>
  );
}
