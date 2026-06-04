import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ROLES, type Role, avatarUrl } from "@/lib/data";
import { VOICE } from "@/lib/copy";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Set your table — 25" },
      { name: "description", content: "Reserve seats for the people who matter most." },
    ],
  }),
  component: Onboarding,
});

// ---------- Mock contacts (in a real app this comes from the OS contact picker) ----------
type Contact = { id: string; name: string; phone: string; avatar: string };
const MOCK_CONTACTS: Contact[] = [
  { id: "c1",  name: "Rahul Mehta",     phone: "+91 98•••••12", avatar: avatarUrl(12) },
  { id: "c2",  name: "Priya Nair",      phone: "+91 99•••••08", avatar: avatarUrl(5)  },
  { id: "c3",  name: "Arjun Kapoor",    phone: "+91 98•••••44", avatar: avatarUrl(13) },
  { id: "c4",  name: "Neha Sharma",     phone: "+91 90•••••21", avatar: avatarUrl(9)  },
  { id: "c5",  name: "Simran Bedi",     phone: "+91 70•••••33", avatar: avatarUrl(16) },
  { id: "c6",  name: "Kabir Anand",     phone: "+91 87•••••91", avatar: avatarUrl(68) },
  { id: "c7",  name: "Tara Krishnan",   phone: "+91 91•••••55", avatar: avatarUrl(1)  },
  { id: "c8",  name: "Aditya Bose",     phone: "+91 99•••••02", avatar: avatarUrl(60) },
  { id: "c9",  name: "Meera Pillai",    phone: "+91 88•••••77", avatar: avatarUrl(44) },
  { id: "c10", name: "Yash Khurana",    phone: "+91 98•••••39", avatar: avatarUrl(51) },
  { id: "c11", name: "Riya D'Souza",    phone: "+91 70•••••18", avatar: avatarUrl(20) },
  { id: "c12", name: "Karan Joshi",     phone: "+91 90•••••64", avatar: avatarUrl(52) },
];

type Reservation = { contact: Contact; role: Role };

function Onboarding() {
  const navigate = useNavigate();
  // 0 welcome → 1 name → 2 contacts permission → 3 pick a contact → 4 assign role → 5 confirm/send → 6 reveal
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [picked, setPicked] = useState<Contact | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [query, setQuery] = useState("");

  const totalSteps = 6;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOCK_CONTACTS.filter(
      (c) =>
        !reservations.find((r) => r.contact.id === c.id) &&
        (!q || c.name.toLowerCase().includes(q)),
    );
  }, [query, reservations]);

  const confirm = () => {
    if (!picked || !role) return;
    setReservations((p) => [...p, { contact: picked, role }]);
    setPicked(null);
    setRole(null);
    setStep(3); // back to picker for the next seat
  };

  const finish = () => {
    try {
      localStorage.setItem(
        "twentyfive.onboarding",
        JSON.stringify({
          name,
          reservations: reservations.map((r) => ({
            name: r.contact.name,
            phone: r.contact.phone,
            role: r.role,
            state: "RESERVED",
            reservedAt: Date.now(),
          })),
          completedAt: Date.now(),
        }),
      );
    } catch {}
    navigate({ to: "/app/home" });
  };

  return (
    <main
      className="min-h-screen w-full text-foreground relative overflow-hidden"
      style={{ fontFamily: "'Inter Tight', 'Inter', system-ui, sans-serif" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(800px 600px at 30% 10%, rgba(196,149,96,0.18), transparent 60%), radial-gradient(700px 700px at 80% 90%, rgba(139,45,42,0.22), transparent 60%), #14100C",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        {/* progress dots */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className="h-[6px] rounded-full transition-all duration-500"
              style={{
                width: i === step ? 28 : 6,
                background: i <= step ? "#C49560" : "rgba(255,255,255,0.18)",
              }}
            />
          ))}
        </div>

        <div className="flex-1 flex flex-col">
          {step === 0 && (
            <StepWrap>
              <Eyebrow>hi.</Eyebrow>
              <h1
                className="font-normal leading-[1.05] text-white"
                style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(2.5rem, 8vw, 3.5rem)" }}
              >
                You're here.
                <br />
                <span className="italic text-[#E8B98A]">Let's set the table.</span>
              </h1>
              <p className="mt-8 text-white/70 leading-relaxed">
                Twenty-five seats. No more, no less. You'll reserve each one
                for someone real — a person, a role, a reason.
              </p>
              <p className="mt-4 text-white/50 text-sm italic">
                We don't browse your contacts. You pick. We hold the seats.
              </p>
              <Spacer />
              <BigBtn onClick={() => setStep(1)}>Pull up a chair</BigBtn>
            </StepWrap>
          )}

          {step === 1 && (
            <StepWrap>
              <Eyebrow>first things first</Eyebrow>
              <Title>What do your people call you?</Title>
              <p className="mt-4 text-white/60 text-sm">
                Not your full government name. The one your friends use.
              </p>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Riya, Ro, the menace"
                className="mt-8 w-full bg-transparent border-b border-white/20 pb-3 text-white text-2xl placeholder:text-white/30 focus:outline-none focus:border-[#C49560] transition"
                style={{ fontFamily: "'Fraunces', Georgia, serif" }}
              />
              <Spacer />
              <BigBtn disabled={!name.trim()} onClick={() => setStep(2)}>
                Nice to meet you{name.trim() ? `, ${name.trim().split(" ")[0]}` : ""}
              </BigBtn>
            </StepWrap>
          )}

          {step === 2 && (
            <StepWrap>
              <Eyebrow>a small ask</Eyebrow>
              <Title>Can we see your contacts?</Title>
              <p className="mt-4 text-white/65 leading-relaxed">
                Only so you can <em>pick</em> from them. We never read your
                contact list, never store the rest, never suggest anyone.
                You do the choosing — always.
              </p>
              <div
                className="mt-8 rounded-3xl p-5 flex items-center gap-4"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div
                  className="h-12 w-12 rounded-2xl flex items-center justify-center text-2xl"
                  style={{ background: "rgba(196,149,96,0.15)" }}
                >
                  📇
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm">Contacts</p>
                  <p className="text-white/50 text-xs">used only for the picker, on-device</p>
                </div>
              </div>
              <Spacer />
              <BigBtn onClick={() => setStep(3)}>Allow contacts</BigBtn>
              <button
                onClick={() => setStep(3)}
                className="mt-3 text-center text-white/40 text-xs hover:text-white/60 transition"
              >
                Skip — I'll add them by hand
              </button>
            </StepWrap>
          )}

          {step === 3 && (
            <StepWrap>
              <Eyebrow>your contacts</Eyebrow>
              <Title>Who gets a seat?</Title>
              <p className="mt-3 text-white/55 text-sm">
                {reservations.length === 0
                  ? "Start with one. You'll add more in your own time."
                  : `${reservations.length} reserved. Keep going, or finish whenever.`}
              </p>

              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search contacts…"
                className="mt-6 w-full bg-transparent border-b border-white/15 pb-2 text-white placeholder:text-white/30 focus:outline-none focus:border-[#C49560] transition text-sm"
              />

              <ul
                className="mt-4 -mx-2 max-h-[44vh] overflow-y-auto"
                style={{ scrollbarWidth: "thin" }}
              >
                {filtered.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => {
                        setPicked(c);
                        setStep(4);
                      }}
                      className="w-full flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-white/[0.04] active:bg-white/[0.07] transition text-left"
                    >
                      <img
                        src={c.avatar}
                        alt=""
                        loading="lazy"
                        className="h-11 w-11 rounded-full object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-[15px] truncate">{c.name}</p>
                        <p className="text-white/45 text-xs truncate">{c.phone}</p>
                      </div>
                      <span className="text-white/30 text-lg">›</span>
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="text-white/40 text-sm text-center py-8 italic">
                    No one left to seat.
                  </li>
                )}
              </ul>

              {reservations.length > 0 && (
                <div className="mt-5">
                  <p className="uppercase tracking-[0.28em] text-[0.6rem] text-white/40 mb-3">
                    reserved
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {reservations.map((r) => (
                      <span
                        key={r.contact.id}
                        className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-white/85"
                        style={{
                          background: "rgba(196,149,96,0.08)",
                          border: "1px dashed rgba(196,149,96,0.4)",
                        }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-[#C49560]" />
                        {r.contact.name.split(" ")[0]} · {r.role.toLowerCase()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <Spacer />
              <BigBtn
                disabled={reservations.length < 1}
                onClick={() => setStep(5)}
              >
                {reservations.length < 1
                  ? "Reserve at least one seat"
                  : `Done — ${reservations.length} ${reservations.length === 1 ? "seat" : "seats"} held`}
              </BigBtn>
            </StepWrap>
          )}

          {step === 4 && picked && (
            <StepWrap>
              <button
                onClick={() => {
                  setPicked(null);
                  setStep(3);
                }}
                className="self-start mb-4 text-white/50 text-sm hover:text-white/80"
              >
                ← back
              </button>
              <Eyebrow>{VOICE.reservation.roleHeader}</Eyebrow>
              <div className="mt-2 flex items-center gap-3">
                <img src={picked.avatar} alt="" className="h-14 w-14 rounded-full object-cover" />
                <div>
                  <p
                    className="text-white text-2xl leading-tight"
                    style={{ fontFamily: "'Fraunces', Georgia, serif" }}
                  >
                    {picked.name}
                  </p>
                  <p className="text-white/45 text-xs">{picked.phone}</p>
                </div>
              </div>
              <p className="mt-5 text-white/55 text-sm">{VOICE.reservation.roleSub}</p>

              <div className="mt-6 grid grid-cols-2 gap-2">
                {ROLES.map((r) => {
                  const active = role === r;
                  return (
                    <button
                      key={r}
                      onClick={() => setRole(r)}
                      className="rounded-2xl px-4 py-3 text-sm text-left transition"
                      style={{
                        background: active ? "rgba(196,149,96,0.16)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${active ? "#C49560" : "rgba(255,255,255,0.10)"}`,
                        color: "white",
                        fontFamily: "'Fraunces', Georgia, serif",
                      }}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>

              <Spacer />
              <BigBtn disabled={!role} onClick={() => setStep(45)}>
                Continue
              </BigBtn>
            </StepWrap>
          )}

          {step === 45 && picked && role && (
            <StepWrap>
              <Eyebrow>{VOICE.reservation.confirmHeader}</Eyebrow>
              <Title>Reserve {picked.name.split(" ")[0]}'s seat?</Title>
              <p className="mt-3 text-white/55 text-sm">
                {VOICE.reservation.sendingTo(picked.name.split(" ")[0])}
              </p>

              {/* WhatsApp-style message preview */}
              <div
                className="mt-5 rounded-2xl p-4 text-[14px] leading-relaxed text-white/90"
                style={{
                  background: "rgba(45,90,55,0.18)",
                  border: "1px solid rgba(120,200,140,0.18)",
                  fontFamily: "'Inter Tight', system-ui, sans-serif",
                }}
              >
                {VOICE.reservation.waMessage(name.trim().split(" ")[0] || "Someone")}
                <div className="mt-3 text-[11px] text-white/40">via WhatsApp · {picked.phone}</div>
              </div>

              <div className="mt-5 flex items-center gap-3 text-white/70 text-xs">
                <span
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1"
                  style={{ background: "rgba(196,149,96,0.10)", border: "1px solid rgba(196,149,96,0.35)" }}
                >
                  role · {role.toLowerCase()}
                </span>
                <span className="text-white/40">seat will be held until they claim it</span>
              </div>

              <Spacer />
              <BigBtn onClick={confirm}>{VOICE.reservation.cta}</BigBtn>
              <button
                onClick={() => setStep(4)}
                className="mt-3 text-center text-white/45 text-xs hover:text-white/70 transition"
              >
                Change role
              </button>
            </StepWrap>
          )}

          {step === 5 && (
            <FinalStep name={name} reservations={reservations} onFinish={finish} />
          )}
        </div>
      </div>
    </main>
  );
}

function FinalStep({
  name,
  reservations,
  onFinish,
}: {
  name: string;
  reservations: Reservation[];
  onFinish: () => void;
}) {
  const taken = reservations.length;
  const remaining = Math.max(0, 25 - taken);

  return (
    <StepWrap>
      <Eyebrow>the table is set</Eyebrow>
      <h1
        className="mt-4 font-normal leading-[1.05] text-white"
        style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(2.25rem, 7vw, 3rem)" }}
      >
        Hey {name.trim().split(" ")[0] || "you"}.
        <br />
        <span className="italic text-[#E8B98A]">These are your people.</span>
      </h1>

      <p className="mt-6 text-white/70 leading-relaxed">
        {taken === 1 ? "One seat reserved. A start." : `${taken} seats reserved.`}{" "}
        {remaining > 0 && (
          <span className="text-white/50">
            {remaining} kept open for whoever wanders in next.
          </span>
        )}
      </p>

      <div className="mt-8 space-y-2">
        {reservations.slice(0, 6).map((r) => (
          <div
            key={r.contact.id}
            className="flex items-center gap-3 rounded-2xl px-3 py-3"
            style={{
              background: "rgba(196,149,96,0.08)",
              border: "1px dashed rgba(196,149,96,0.35)",
            }}
          >
            <img src={r.contact.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm truncate">{r.contact.name}</p>
              <p className="text-white/45 text-xs">{r.role.toLowerCase()} · awaiting them</p>
            </div>
            <span className="text-[#C49560] text-[10px] uppercase tracking-[0.2em]">held</span>
          </div>
        ))}
      </div>

      <p className="mt-8 italic text-white/55 text-sm">
        Their seat is reserved. When they sit down, you'll know — quietly.
      </p>

      <Spacer />
      <BigBtn onClick={onFinish}>Open the table</BigBtn>
      <p className="mt-3 text-center text-white/30 text-xs">
        one of twenty-five. irreplaceable.
      </p>
    </StepWrap>
  );
}

function StepWrap({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 flex flex-col animate-[fade_400ms_ease-out]">{children}</div>;
}
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="uppercase tracking-[0.32em] text-[0.7rem] text-[#C49560] mb-4">
      {children}
    </p>
  );
}
function Title({ children }: { children: React.ReactNode }) {
  return (
    <h1
      className="font-normal leading-[1.1] text-white"
      style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(2rem, 6vw, 2.75rem)" }}
    >
      {children}
    </h1>
  );
}
function Spacer() {
  return <div className="flex-1 min-h-[32px]" />;
}
function BigBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-full py-4 text-sm font-medium transition disabled:opacity-40 active:scale-[0.98]"
      style={{ background: "#C49560", color: "#14100C" }}
    >
      {children}
    </button>
  );
}
