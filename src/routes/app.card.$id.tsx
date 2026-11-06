import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Cake } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Confetti, Toast, buzz, clientOnly } from "@/components/SocialUI";
import { friendById, meView, useSocial } from "@/lib/social";
import { bdayLabel, daysUntil, loadCard, signCard, useBirthdays, type CardNote } from "@/lib/birthdays";

export const Route = createFileRoute("/app/card/$id")({
  head: () => ({ meta: [{ title: "Birthday card · 25" }] }),
  component: clientOnly(CardScreen),
});

const TONES = ["var(--lime)", "var(--pink)", "var(--sky)", "var(--sun)"];

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
        <Cake size={48} strokeWidth={2} aria-hidden="true" className="mx-auto" style={{ color: "var(--pink)" }} />
        <div className="flex justify-center mt-3">
          <span className="rounded-full" style={{ border: "var(--bd)", boxShadow: "0 0 0 4px var(--pink)" }}>
            <Avatar src={person?.avatar || undefined} initials={person?.initials ?? "?"} size={84} />
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
            <p className="meta mt-0.5">
              Only {first} and the people who sign can read the card.
            </p>
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

      <section className="px-5 mt-6">
        <h2 className="heading" style={{ fontSize: 19 }}>
          {notes?.length ? `${notes.length} signature${notes.length > 1 ? "s" : ""}` : "No signatures yet"}
        </h2>
        {!mine && !signed && (notes?.length ?? 0) > 0 && (
          <p className="meta mt-1">Sign it to read what everyone wrote</p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(notes ?? []).map((n, i) => {
            const who = n.author === "me" ? meView() : friendById(n.author);
            const hidden = !mine && !signed;
            return (
              <div
                key={i}
                className="rounded-2xl p-3.5"
                style={{
                  background: TONES[i % TONES.length],
                  color: "var(--on-accent)",
                  border: "var(--bd)",
                  boxShadow: "var(--pop)",
                  transform: `rotate(${i % 2 ? 2 : -2}deg)`,
                }}
              >
                <p
                  className="font-bold text-[14px] leading-snug"
                  style={{ filter: hidden ? "blur(6px)" : "none" }}
                >
                  {n.body}
                </p>
                <p className="mt-2 text-[12px] font-extrabold opacity-80">
                  — {n.author === "me" ? "you" : (who?.name.split(" ")[0] ?? "someone")}
                </p>
              </div>
            );
          })}
        </div>
      </section>
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
      <Confetti fire={party} />
    </div>
  );
}
