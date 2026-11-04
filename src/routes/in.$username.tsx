import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { KnowThemQuiz } from "@/components/KnowThemQuiz";
import { clientOnly } from "@/components/SocialUI";
import { account, initLive } from "@/lib/live";
import { useSocial, type Person } from "@/lib/social";
import { publicCard, type PublicCard } from "@/lib/vibes";

export const Route = createFileRoute("/in/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `Are you in @${params.username}'s 25?` },
      {
        name: "description",
        content: "Prove it: guess their vibe-check answers to claim a seat at their table.",
      },
      { property: "og:title", content: `Are you in @${params.username}'s 25?` },
      {
        property: "og:description",
        content: "Prove it: guess 4 of their 6 answers to claim a seat.",
      },
    ],
  }),
  component: clientOnly(InMy25),
});

const PENDING_INVITE = "tf.pendingInvite";
const COLOURS = [
  "rgba(111,87,240,0.55)",
  "rgba(111,87,240,0.25)",
  "rgba(255,255,255,0.12)",
  "rgba(111,87,240,0.4)",
];

function InMy25() {
  const { username } = Route.useParams();
  const s = useSocial();
  const navigate = useNavigate();
  const [card, setCard] = useState<PublicCard | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => initLive(), []);
  useEffect(() => {
    publicCard(username)
      .then(setCard)
      .catch((e) => setError((e as Error).message));
  }, [username]);

  const live = s.mode === "live" && !!s.me;
  const isMe = live && s.me?.username === username.toLowerCase();
  const alreadyIn = !!card && s.people.some((p) => p.id === card.id);
  const pending =
    !!card && s.requests.some((r) => r.person.id === card.id && r.direction === "outgoing");
  const incoming = card
    ? s.requests.find((r) => r.person.id === card.id && r.direction === "incoming")
    : undefined;

  const prove = () => {
    if (!live) {
      try {
        localStorage.setItem(PENDING_INVITE, username.toLowerCase());
      } catch {
        // ignore
      }
      navigate({ to: "/login" });
      return;
    }
    if (!s.me?.vibeDone) {
      try {
        localStorage.setItem(PENDING_INVITE, username.toLowerCase());
      } catch {
        // ignore
      }
      navigate({ to: "/vibe" });
      return;
    }
    setQuiz(true);
  };

  const person: Person | null = card
    ? {
        id: card.id,
        name: card.display_name,
        username: card.username,
        initials: card.display_name
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        color: "#3A3044",
        avatar: "",
        postedToday: false,
        joinedDaysAgo: 0,
        daysQuiet: 0,
      }
    : null;
  const first = card?.display_name.split(" ")[0] ?? `@${username}`;

  return (
    <main className="min-h-screen px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] overflow-hidden">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="25 home">
            <Logo height={44} />
          </Link>
          {!live && (
            <Link to="/login" className="btn-secondary min-h-[40px] px-4 text-sm">
              Sign in
            </Link>
          )}
        </div>

        {card === undefined && !error && (
          <p className="mt-24 text-center heading">Finding their table…</p>
        )}
        {(error || card === null) && (
          <div className="mt-20 text-center">
            <span className="sticker pink">hmm</span>
            <p className="heading mt-4">No one called @{username} here.</p>
            <p className="mt-2 text-cool">Check the link, or ask them to send it again.</p>
            <Link to="/" className="btn-primary mt-6 px-6">
              What is 25?
            </Link>
          </div>
        )}

        {card && person && (
          <>
            <div className="relative mt-10">
              {COLOURS.map((c, i) => (
                <span
                  key={c}
                  aria-hidden="true"
                  className="absolute rounded-full float"
                  style={{
                    width: 26 + i * 6,
                    height: 26 + i * 6,
                    background: c,
                    border: "1px solid var(--line-2)",
                    left: `${[4, 80, 88, 10][i]}%`,
                    top: `${[-6, 4, 62, 70][i]}%`,
                    animationDelay: `${i * 0.6}s`,
                  }}
                />
              ))}
              <div className="relative black-card p-6 text-center">
                <div className="flex justify-center">
                  <span
                    className="rounded-full"
                    style={{ border: "1px solid var(--line-2)", boxShadow: "var(--pop)" }}
                  >
                    <Avatar initials={person.initials} color="#3A3044" size={84} />
                  </span>
                </div>
                <p className="mt-3 font-extrabold" style={{ fontSize: 18 }}>
                  {card.display_name}
                </p>
                <p className="text-sm opacity-90">@{card.username}</p>
                <h1
                  className="display mt-5"
                  style={{
                    fontSize: 46,
                    lineHeight: 0.95,
                    fontWeight: 800,
                    letterSpacing: "-0.04em",
                  }}
                >
                  Are you in
                  <br />
                  my{" "}
                  <span className="serif-italic" style={{ color: "var(--lime)" }}>
                    25
                  </span>
                  ?
                </h1>
                <p className="mt-3 opacity-95">
                  {card.seats}/25 seats taken. {25 - card.seats} left.
                </p>
              </div>
            </div>

            <div className="mt-10">
              {isMe ? (
                <p className="text-center heading">
                  This is your card. Share it and see who really knows you.
                </p>
              ) : alreadyIn ? (
                <div className="text-center">
                  <span className="sticker">already in</span>
                  <p className="heading mt-3">You're in {first}'s 25.</p>
                  <Link
                    to="/app/chat/$id"
                    params={{ id: card.id }}
                    className="btn-primary w-full mt-5"
                  >
                    Message {first}
                  </Link>
                </div>
              ) : pending || done ? (
                <div className="text-center">
                  <span className="sticker sun">seat saved</span>
                  <p className="heading mt-3">Now {first} has to prove they know you.</p>
                  <Link to="/app/people" className="btn-secondary w-full mt-5">
                    See your 25
                  </Link>
                </div>
              ) : !card.vibe_done ? (
                <p className="text-center heading">
                  {first} hasn't done their vibe check yet. Nudge them!
                </p>
              ) : (
                <>
                  <button
                    onClick={prove}
                    className="btn-fun w-full"
                    style={{ minHeight: 56, fontSize: 18 }}
                  >
                    Prove it
                  </button>
                  <p className="mt-3 text-center meta">
                    Guess 4 of {first}'s 6 answers to claim a seat. One try every 30 minutes.
                  </p>
                </>
              )}
            </div>
          </>
        )}

        <p className="mt-14 text-center meta">
          25: the app for the only people who matter. No followers. No strangers.
        </p>
      </div>

      {quiz && person && (
        <KnowThemQuiz
          person={person}
          onClose={() => setQuiz(false)}
          onPassed={async () => {
            if (incoming) await account.accept(incoming.id);
            else await account.request(person.id);
            setDone(true);
          }}
        />
      )}
    </main>
  );
}
