/**
 * The first time you open the app on someone's birthday: a pop-up to wish
 * them. On your own birthday: one to open your card of wishes. Once a day each.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Avatar } from "@/components/Avatar";
import { Glyph3D } from "@/components/Glyph3D";
import { Confetti, buzz } from "@/components/SocialUI";
import { daysUntil, loadCard, useBirthdays } from "@/lib/birthdays";
import { dayKey, friendById, meView, useSocial } from "@/lib/social";

/** eve: their birthday is tomorrow (sign tonight, they open it at 12 AM). */
type Pop = { id: string; mine: boolean; eve: boolean };

export function BirthdayPop() {
  const s = useSocial();
  const list = useBirthdays();
  const navigate = useNavigate();
  const [pop, setPop] = useState<Pop | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [party, setParty] = useState(0);

  useEffect(() => {
    if (pop) return;
    // Your own birthday (today); friends' birthdays tomorrow (sign the card the
    // evening before) and today (if you haven't signed yet).
    const mine = list.filter((b) => b.id === "me" && daysUntil(b) === 0);
    const soon = list.filter((b) => b.id !== "me" && daysUntil(b) <= 1);
    for (const b of [...mine, ...soon]) {
      if (b.id !== "me" && !friendById(b.id)) continue;
      const key = `tf.bday.pop.${dayKey()}.${b.id}`;
      try {
        if (localStorage.getItem(key)) continue;
        localStorage.setItem(key, "1");
      } catch {
        continue;
      }
      setPop({ id: b.id, mine: b.id === "me", eve: daysUntil(b) === 1 });
      return;
    }
  }, [list, pop]);

  useEffect(() => {
    if (!pop) return;
    setCount(null);
    const t = setTimeout(() => {
      setParty((n) => n + 1);
      buzz(40);
    }, 350);
    if (pop.mine && s.me) void loadCard(s.me.id).then((n) => setCount(n.length));
    else
      void loadCard(pop.id).then((n) => {
        // Already signed: nothing to ask.
        if (n.some((x) => x.author === "me")) setPop(null);
        else setCount(n.length);
      });
    return () => clearTimeout(t);
  }, [pop, s.me]);

  if (!pop) return <Confetti fire={party} />;
  const person = pop.mine ? meView() : friendById(pop.id);
  const first = person?.name.split(" ")[0] ?? "them";
  const close = () => setPop(null);
  const go = () => {
    close();
    navigate({ to: "/app/card/$id", params: { id: pop.id } });
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-6"
      style={{ background: "rgba(7,6,11,0.7)", backdropFilter: "blur(6px)" }}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={pop.mine ? "Happy birthday" : `${first}'s birthday`}
    >
      <div
        className="animate-soft-in w-full max-w-[340px] rounded-[30px] px-6 pt-7 pb-6 text-center relative overflow-hidden"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, rgba(242,125,166,0.45), transparent 60%), radial-gradient(100% 70% at 50% 100%, rgba(193,239,98,0.22), transparent 60%), #1B1724",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6), 0 0 0 6px rgba(242,125,166,0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative inline-block">
          <span
            className="absolute left-1/2 -translate-x-1/2"
            style={{ top: -30, lineHeight: 0, zIndex: 2 }}
          >
            <Glyph3D name="partyhat" size={54} />
          </span>
          <span
            className="block rounded-full"
            style={{ boxShadow: "0 0 0 4px var(--pink), 0 0 40px rgba(242,125,166,0.7)" }}
          >
            <Avatar
              src={person?.avatar || undefined}
              initials={person?.initials ?? "?"}
              size={104}
            />
          </span>
        </div>
        <p
          className="mt-5 text-[13px] font-extrabold tracking-[0.18em] uppercase"
          style={{ color: "var(--pink)" }}
        >
          🎂 {pop.eve ? "Tomorrow" : "Today"}
        </p>
        <h2 className="title mt-1" style={{ fontSize: 28, lineHeight: 1.1 }}>
          {pop.mine
            ? `Happy birthday, ${first}!`
            : pop.eve
              ? `${first}'s birthday is tomorrow!`
              : `It's ${first}'s birthday!`}
        </h2>
        <p className="mt-2 text-[15px]" style={{ color: "var(--ink-2)" }}>
          {pop.mine
            ? count
              ? `Your 25 left you ${count} wish${count === 1 ? "" : "es"}. Open your card 🎁`
              : "Your 25 are signing your card. Open it 🎁"
            : pop.eve
              ? `Sign their card tonight. ${first} opens it at 12 AM 🎁${count ? ` · ${count} already signed` : ""}`
              : count
                ? `${count} of your 25 already wished. Add yours ✍️`
                : `Be the first to wish ${first} ✍️`}
        </p>
        <button onClick={go} className="btn-primary w-full mt-5">
          {pop.mine ? "Open my card" : pop.eve ? "Sign the card" : `Wish ${first}`}
        </button>
        <button
          onClick={close}
          className="w-full mt-2 min-h-[44px] text-[14px] font-bold"
          style={{ color: "var(--ink-2)" }}
        >
          Later
        </button>
      </div>
      <Confetti fire={party} />
    </div>
  );
}
