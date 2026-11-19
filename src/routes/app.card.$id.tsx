import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Cake } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Confetti, Toast, buzz, clientOnly } from "@/components/SocialUI";
import { friendById, meView, useSocial } from "@/lib/social";
import {
  bdayLabel,
  cardOpen,
  daysUntil,
  loadCard,
  signCard,
  useBirthdays,
  type CardNote,
} from "@/lib/birthdays";
import { Glyph3D } from "@/components/Glyph3D";

export const Route = createFileRoute("/app/card/$id")({
  head: () => ({ meta: [{ title: "Birthday card · 25" }] }),
  component: clientOnly(CardScreen),
});

const TONES = ["var(--lime)", "var(--pink)", "var(--sky)", "var(--sun)"];
const CONFETTI: [number, number, string, number][] = [
  [6, 4, "#F27DA6", 20],
  [18, 10, "#C1EF62", -30],
  [84, 5, "#7CC7FF", 40],
  [93, 14, "#FFD25E", -15],
  [3, 40, "#FFD25E", 60],
  [96, 46, "#F27DA6", -50],
  [8, 86, "#7CC7FF", 25],
  [90, 92, "#C1EF62", -20],
];

function CardScreen() {
  const { id } = Route.useParams();
  const s = useSocial();
  const navigate = useNavigate();
  const mine = id === "me" || id === s.me?.id;
  const target = mine ? (s.me?.id ?? "me") : id;
  const person = mine ? meView() : friendById(id);
  const bdays = useBirthdays();
  const b = bdays.find((x) => x.id === (mine ? "me" : id));
  const [notes, setNotes] = useState<CardNote[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [party, setParty] = useState(0);

  const reload = () => void loadCard(target).then(setNotes);
  useEffect(reload, [target]);
  useEffect(() => {
    if (mine && b && daysUntil(b) === 0) setParty(1);
  }, [mine, b]);

  const first = person?.name.split(" ")[0] ?? "them";
  // Your own card stays shut until your birthday (the database enforces it too).
  const locked = mine && !!b && !cardOpen(b);
  const signed = notes?.some((n) => n.author === "me");

  return (
    <div className="pb-10">
      <header className="band px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8 text-center">
        <div className="flex">
          <button
            onClick={() => navigate({ to: "/app/home" })}
            aria-label="Back"
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center"
          >
            <ArrowLeft size={18} />
          </button>
        </div>
        <Cake
          size={48}
          strokeWidth={2}
          aria-hidden="true"
          className="mx-auto"
          style={{ color: "var(--pink)" }}
        />
        <div className="flex justify-center mt-3">
          <span
            className="rounded-full"
            style={{ border: "var(--bd)", boxShadow: "0 0 0 4px var(--pink)" }}
          >
            <Avatar
              src={person?.avatar || undefined}
              initials={person?.initials ?? "?"}
              size={84}
            />
          </span>
        </div>
        <h1 className="title mt-4" style={{ fontSize: 30 }}>
          {mine ? "Your birthday card" : `Happy birthday, ${first}!`}
        </h1>
        {b && (
          <p className="sub mt-1">
            {bdayLabel(b)} ·{" "}
            {daysUntil(b) === 0 ? "TODAY" : `in ${daysUntil(b)} day${daysUntil(b) > 1 ? "s" : ""}`}
          </p>
        )}
      </header>

      {!mine && !signed && (
        <section className="px-5 mt-6">
          <div className="card p-4">
            <p className="font-bold text-cream">Sign {first}'s card</p>
            <p className="meta mt-0.5">{first} and your 25 can read the card.</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 280))}
              placeholder={`Something only you would say to ${first}…`}
              rows={3}
              className="input mt-3 w-full"
              style={{ minHeight: 90, paddingTop: 12 }}
            />
            <button
              disabled={!text.trim() || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await signCard(target, text.trim());
                  setText("");
                  setParty((n) => n + 1);
                  buzz(30);
                  reload();
                } catch (e) {
                  setToast((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
              className="btn-primary w-full mt-3"
            >
              {busy ? "Signing…" : "Sign the card"}
            </button>
          </div>
        </section>
      )}

      {locked ? (
        <section className="px-5 mt-8 text-center">
          <Glyph3D name="cake" size={88} animate fps={2} />
          <h2 className="heading mt-3" style={{ fontSize: 20 }}>
            No peeking 👀
          </h2>
          <p className="meta mt-1.5 px-4">
            Your card opens on your birthday{b ? `, ${bdayLabel(b)}` : ""}. Your 25 might be signing
            it right now.
          </p>
        </section>
      ) : (
        <section className="px-4 mt-6">
          {/* The card itself: a folded greeting card your 25 signed. */}
          <div
            className="relative rounded-[26px] px-4 pt-6 pb-5 overflow-hidden"
            style={{
              background:
                "radial-gradient(90% 60% at 0% 0%, rgba(242,125,166,0.35), transparent 60%), radial-gradient(80% 60% at 100% 100%, rgba(193,239,98,0.25), transparent 60%), linear-gradient(180deg, #FFF8F1, #FDEFE6)",
              color: "#2A2233",
              boxShadow: "0 24px 60px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.6)",
            }}
          >
            <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
              {CONFETTI.map(([x, y, c, r], k) => (
                <span
                  key={k}
                  className="absolute rounded-[2px]"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    width: 7,
                    height: 12,
                    background: c,
                    transform: `rotate(${r}deg)`,
                    opacity: 0.7,
                  }}
                />
              ))}
            </div>
            <p
              className="relative text-center font-black leading-none"
              style={{
                fontSize: 34,
                letterSpacing: "-0.02em",
                fontStyle: "italic",
                color: "#E0457B",
              }}
            >
              Happy Birthday
            </p>
            <p className="relative text-center font-extrabold mt-1" style={{ fontSize: 22 }}>
              {mine ? (s.me?.name.split(" ")[0] ?? "you") : first} 🎉
            </p>
            <p className="relative text-center text-[13px] font-bold mt-1 opacity-60">
              {notes?.length
                ? `${notes.length} wish${notes.length > 1 ? "es" : ""} from ${mine ? "your" : "their"} 25`
                : mine
                  ? "No wishes yet. They're coming 💌"
                  : `No wishes yet. Be the first!`}
            </p>
            <div className="relative mt-5 space-y-3">
              {(notes ?? []).map((n, i) => {
                const who = n.author === "me" ? meView() : friendById(n.author);
                return (
                  <div
                    key={i}
                    className="rounded-2xl p-3.5 flex gap-3 items-start"
                    style={{
                      background: TONES[i % TONES.length],
                      color: "var(--on-accent)",
                      boxShadow: "0 6px 16px rgba(42,34,51,0.18)",
                      transform: `rotate(${i % 2 ? 0.8 : -0.8}deg)`,
                    }}
                  >
                    <span
                      className="shrink-0 rounded-full"
                      style={{ boxShadow: "0 0 0 2px rgba(255,255,255,0.8)" }}
                    >
                      <Avatar
                        src={who?.avatar || undefined}
                        initials={who?.initials ?? "?"}
                        size={36}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-extrabold opacity-75">
                        {n.author === "me" ? "You" : (who?.name.split(" ")[0] ?? "Someone")}
                      </p>
                      <p className="font-bold text-[15px] leading-snug break-words">{n.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="relative text-center text-[12px] font-bold mt-5 opacity-50">
              with love, from {mine ? "your" : first + "'s"} 25 💛
            </p>
          </div>
        </section>
      )}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
      <Confetti fire={party} />
    </div>
  );
}
