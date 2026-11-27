/**
 * "Set your table": the first thing a new member sees on the Table. Their
 * ring of 25 seats is empty, and three ways to fill it are right there:
 * share your link (WhatsApp or anywhere), seat people already on 25, or
 * search by name.
 *
 * Shown right after signing up, then once a day (three days at most) while
 * fewer than 3 seats are filled.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Link2, MessageCircle, Search, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { SeatMark } from "@/components/Logo";
import { buzz } from "@/components/SocialUI";
import { useSuggestions } from "@/components/Suggestions";
import { useSocial } from "@/lib/social";
import { shareCard, shareUrl } from "@/lib/vibes";

const KEY = "tf.filltable.v1";
const ENOUGH = 3; // seats filled before we stop asking
const MAX_DAYS = 3;
const today = () => new Date().toDateString();

/** Should the "Set your table" moment show now? (Marks it shown for today.) */
export function useFillTable(): [boolean, () => void] {
  const s = useSocial();
  const [open, setOpen] = useState(false);
  const ready = s.mode === "live" && !!s.me && !s.loading && !!s.me.vibeDone;
  const few = s.people.length < ENOUGH;
  useEffect(() => {
    if (!ready || !few) return;
    try {
      const st = JSON.parse(localStorage.getItem(KEY) ?? "{}") as { day?: string; n?: number };
      if (st.day === today() || (st.n ?? 0) >= MAX_DAYS) return;
      localStorage.setItem(KEY, JSON.stringify({ day: today(), n: (st.n ?? 0) + 1 }));
      setOpen(true);
    } catch {
      // Storage blocked: don't nag.
    }
  }, [ready, few]);
  return [open, () => setOpen(false)];
}

export function FillTable({ onClose }: { onClose: () => void }) {
  const s = useSocial();
  const { list } = useSuggestions(true);
  const [note, setNote] = useState<string | null>(null);
  const me = s.me!;
  const first = me.name.split(" ")[0];
  const filled = s.people.length;
  const url = shareUrl(me.username);
  const message = `I saved you a seat at my 25 👀 Only 25 people get one. Prove you know me: ${url}`;

  useEffect(() => {
    const t = setTimeout(() => buzz(20), 300);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  const share = async () => {
    const r = await shareCard(me.username, me.name);
    if (r === "copied") setNote("Link copied. Paste it anywhere.");
    else if (r === "failed") setNote(url);
  };

  return (
    <div
      className="fixed inset-0 z-[75] overflow-y-auto animate-soft-in"
      style={{
        background:
          "radial-gradient(120% 60% at 50% 0%, rgba(193,239,98,0.16), transparent 60%), var(--page)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Set your table"
    >
      <div className="mx-auto w-full max-w-md px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex justify-end">
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-cool"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex flex-col items-center text-center">
          <span className="pop">
            <SeatMark filled={filled} size={168} />
          </span>
          <p
            className="mt-3 font-extrabold tabular-nums"
            style={{ color: "var(--lime)", fontSize: 14 }}
          >
            {filled} of 25 seats filled
          </p>
          <h1 className="title mt-3" style={{ fontSize: 30, lineHeight: 1.1 }}>
            {filled ? `Keep going, ${first}.` : `Your table is set for 25.`}
          </h1>
          <p className="mt-2 text-cool" style={{ fontSize: 16, lineHeight: 1.45, maxWidth: 320 }}>
            {filled
              ? "A table this empty is a little sad. Who else gets a seat?"
              : "Right now it's just you. Who are the first people you'd call at 3 AM?"}
          </p>
        </div>

        {/* 1. Save a seat: send your link */}
        <section className="mt-7 card p-4" aria-label="Invite your people">
          <p className="font-extrabold" style={{ fontSize: 17 }}>
            Save a seat for someone
          </p>
          <p className="meta mt-0.5" style={{ fontSize: 13.5 }}>
            Send your link. They sign up, prove they know you, and they're in.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => buzz(10)}
              className="btn-primary min-h-[50px] flex items-center justify-center gap-2"
            >
              <MessageCircle size={18} aria-hidden="true" /> WhatsApp
            </a>
            <button
              onClick={() => void share()}
              className="btn-secondary min-h-[50px] flex items-center justify-center gap-2"
            >
              <Link2 size={18} aria-hidden="true" /> Share link
            </button>
          </div>
          {note && (
            <p
              className="mt-2 text-[13px] break-all"
              style={{ color: "var(--lime)" }}
              role="status"
            >
              {note}
            </p>
          )}
        </section>

        {/* 2. People already here */}
        {list.length > 0 && (
          <section className="mt-4 card p-4" aria-label="Already on 25">
            <p className="font-extrabold" style={{ fontSize: 17 }}>
              Already on 25
            </p>
            <ul className="mt-2 grid gap-1">
              {list.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-1.5">
                  <Avatar
                    src={p.avatar || undefined}
                    initials={p.initials}
                    color={p.color}
                    size={42}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{p.name}</p>
                    <p className="meta truncate" style={{ fontSize: 12.5 }}>
                      {p.reason === "seated_you" ? "Saved you a seat" : `@${p.username}`}
                    </p>
                  </div>
                  <Link
                    to="/in/$username"
                    params={{ username: p.username ?? "" }}
                    onClick={onClose}
                    className="btn-primary min-h-[36px] px-3.5 text-[13.5px] shrink-0"
                  >
                    {p.reason === "seated_you" ? "Seat back" : "Prove it"}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 3. Search */}
        <Link to="/app/people" onClick={onClose} className="mt-4 card p-4 flex items-center gap-3">
          <span
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--fill)" }}
          >
            <Search size={18} aria-hidden="true" />
          </span>
          <span className="flex-1">
            <span className="block font-bold">Find someone by name</span>
            <span className="block meta" style={{ fontSize: 13 }}>
              Search everyone on 25
            </span>
          </span>
          <span aria-hidden="true" className="text-cool">
            ›
          </span>
        </Link>

        <button
          onClick={onClose}
          className="mt-5 w-full min-h-[44px] text-[14px] font-bold"
          style={{ color: "var(--ink-2)" }}
        >
          I'll do it later
        </button>
      </div>
    </div>
  );
}
