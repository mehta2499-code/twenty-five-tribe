import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FriendPicker, PageBand, Sheet, Toast } from "@/components/SocialUI";
import { ARCADE, Leaderboard, QuickMath, TapRush } from "@/components/ArcadeGames";
import { KachufulLobby, LocalKachuful } from "@/components/Kachuful";
import { TriviaGame } from "@/components/TriviaGame";
import { PackIcon } from "@/components/PackIcon";
import { TRIVIA_PACKS, TRIVIA_QUESTIONS, type TriviaPack } from "@/lib/data";
import {
  botSeats,
  listMyGames,
  seatFor,
  startKachuful,
  startTriviaChallenge,
  type GameRow,
  type TriviaState,
} from "@/lib/games";
import type { KState, Seat } from "@/lib/kachuful";
import { friendById, leaderboard, meView, useSocial } from "@/lib/social";

export const Route = createFileRoute("/app/games")({
  component: Games,
});

function YourGames({ meId }: { meId: string }) {
  const [games, setGames] = useState<GameRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => listMyGames().then((g) => alive && setGames(g));
    void load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  const open = (games ?? []).filter((g) => g.status === "playing");
  if (!open.length) return null;
  return (
    <section className="mt-7">
      <div className="px-5 flex items-center justify-between mb-2">
        <h2 className="text-[15px] font-semibold text-cream">Your games</h2>
        <span className="meta">{open.length} in progress</span>
      </div>
      <div className="flex gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {open.map((g) => {
          const others = g.players
            .filter((p) => p !== meId)
            .map((p) => friendById(p))
            .filter(Boolean);
          let title = "";
          let status = "";
          let yourTurn = false;
          if (g.kind === "kachuful") {
            const k = g.state as KState;
            const turn = k.seats[k.turn];
            yourTurn = turn?.id === meId || (k.phase === "roundEnd" && g.host === meId);
            title = `Kachuful · round ${k.round + 1}/${k.plan.length}`;
            status = yourTurn
              ? "Your turn"
              : turn
                ? `${turn.name.split(" ")[0]}'s turn`
                : "In play";
          } else {
            const t = g.state as TriviaState;
            const pack = TRIVIA_PACKS.find((p) => p.id === t.pack);
            yourTurn = !t.results[meId];
            title = `${pack?.name ?? "Trivia"} challenge`;
            status = yourTurn
              ? "Your turn"
              : `Waiting for ${others[0]?.name.split(" ")[0] ?? "them"}`;
          }
          return (
            <Link
              key={g.id}
              to="/app/play/$id"
              params={{ id: g.id }}
              className="shrink-0 w-56 card p-4 text-left hover:bg-[var(--fill)]"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-cream text-sm truncate">{title}</span>
                <ChevronRight size={16} className="text-bronze shrink-0" />
              </div>
              <div className="mt-3 flex -space-x-2">
                {others.slice(0, 5).map((f) => (
                  <span key={f!.id} className="rounded-full" style={{ outline: "2px solid #fff" }}>
                    <Avatar
                      src={f!.avatar || undefined}
                      initials={f!.initials}
                      color={f!.color}
                      size={28}
                    />
                  </span>
                ))}
              </div>
              <p
                className="mt-3 text-[13px] font-semibold"
                style={{ color: yourTurn ? "var(--coral-deep)" : "var(--text-muted)" }}
              >
                {status}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Games() {
  const s = useSocial();
  const navigate = useNavigate();
  const live = s.mode === "live" && !!s.me;
  const [arcade, setArcade] = useState<"tap-rush" | "quick-math" | null>(null);
  const [lobby, setLobby] = useState(false);
  const [localTable, setLocalTable] = useState<{ seats: Seat[]; length: "short" | "full" } | null>(
    null,
  );
  const [packFor, setPackFor] = useState<TriviaPack | null>(null);
  const [soloPack, setSoloPack] = useState<TriviaPack | null>(null);
  const [challengePack, setChallengePack] = useState<TriviaPack | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const me = meView();
  const mySeat = (): Seat =>
    seatFor({
      id: s.me?.id ?? "me",
      name: me.name === "You" ? "You" : me.name,
      avatar: me.avatar,
      initials: me.initials,
    });

  return (
    <>
      <PageBand title="Games" sub="Play with your 25. Scores reset every Monday." />

      {live && <YourGames meId={s.me!.id} />}

      {/* Kachuful */}
      <section className="px-5 mt-7">
        <h2 className="text-[15px] font-semibold text-cream mb-2.5">Cards</h2>
        <button
          onClick={() => setLobby(true)}
          className="w-full text-left p-5 relative overflow-hidden band"
          style={{ borderRadius: 20 }}
        >
          <span className="label-caps">Most played in India</span>
          <div className="mt-3 flex gap-1.5" aria-hidden="true">
            {["♠", "♦", "♣", "♥"].map((x, i) => (
              <span
                key={x}
                className="w-10 h-14 rounded-lg bg-white flex items-center justify-center text-2xl font-bold"
                style={{
                  color: i % 2 ? "var(--coral-deep)" : "var(--ink)",
                  transform: `rotate(${(i - 1.5) * 6}deg)`,
                }}
              >
                {x}
              </span>
            ))}
          </div>
          <h3 className="mt-4 font-display" style={{ fontSize: 28 }}>
            Kachuful
          </h3>
          <p className="sub mt-1" style={{ fontSize: 14, lineHeight: 1.5 }}>
            Also called Judgement. Call your tricks, then win exactly that many. 3 to 7 players;
            bots fill empty seats.
          </p>
          <span className="mt-4 inline-block btn-cream px-5 py-2.5" style={{ fontSize: 14 }}>
            Deal me in →
          </span>
        </button>
      </section>

      {/* Quick games */}
      <section className="px-5 mt-7">
        <h2 className="text-[15px] font-semibold text-cream mb-2.5">Quick games</h2>
        <div className="grid grid-cols-2 gap-3">
          {ARCADE.map((g) => {
            const best = s.scores[g.id]?.me;
            const board = leaderboard(s, g.id);
            const rank = board.findIndex((r) => r.id === "me") + 1;
            return (
              <button
                key={g.id}
                onClick={() => setArcade(g.id)}
                className="p-4 text-left card hover:bg-[var(--fill)]"
              >
                <span className="die-tile" style={{ width: 40, height: 40 }}>
                  <g.Icon size={20} aria-hidden="true" />
                </span>
                <h3 className="mt-3 font-semibold text-cream" style={{ fontSize: 17 }}>
                  {g.name}
                </h3>
                <p className="text-cool mt-1" style={{ fontSize: 12, lineHeight: 1.4 }}>
                  {g.blurb}
                </p>
                <p
                  className="mt-3 text-[13px] font-semibold"
                  style={{ color: best != null ? "var(--blue-deep)" : "var(--ink-3)" }}
                >
                  {best != null ? `Best ${best} · #${rank} of ${board.length}` : "Not played yet"}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Trivia */}
      <section className="mt-7">
        <div className="px-5 flex items-baseline justify-between mb-2.5">
          <h2 className="text-[15px] font-semibold text-cream">India trivia</h2>
          <span className="meta">Solo or challenge a friend</span>
        </div>
        <div className="flex gap-3 overflow-x-auto px-5 pb-2 no-scrollbar">
          {TRIVIA_PACKS.map((p) => {
            const free = p.price === "Free";
            const count = TRIVIA_QUESTIONS[p.id]?.length ?? 0;
            return (
              <button
                key={p.id}
                onClick={() => setPackFor(p)}
                disabled={!free}
                aria-label={free ? `${p.name}, ${count} questions` : `${p.name}, coming soon`}
                className="shrink-0 w-44 overflow-hidden text-left card"
                style={{ opacity: free ? 1 : 0.6 }}
              >
                <div className="p-4 h-32 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <PackIcon id={p.id} />
                    {!free && (
                      <span className="chip" style={{ minHeight: 24, fontSize: 12 }}>
                        Coming soon
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-cream" style={{ fontSize: 16 }}>
                      {p.name}
                    </div>
                    <div className="meta mt-0.5 line-clamp-2" style={{ fontSize: 12.5 }}>
                      {count} questions · {p.tagline}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <Leaderboard />

      <p className="text-center meta px-6 pt-8 pb-2">Only your 25 see your scores.</p>

      {lobby && (
        <KachufulLobby
          onClose={() => setLobby(false)}
          onStart={async (friends, bots, length) => {
            setLobby(false);
            if (live && friends.length) {
              try {
                const id = await startKachuful(friends, bots, length);
                navigate({ to: "/app/play/$id", params: { id } });
              } catch (e) {
                setToast((e as Error).message);
              }
            } else {
              setLocalTable({ seats: [mySeat(), ...botSeats(bots)], length });
            }
          }}
        />
      )}
      {localTable && (
        <LocalKachuful
          seats={localTable.seats}
          length={localTable.length}
          onClose={() => setLocalTable(null)}
        />
      )}

      {packFor && (
        <Sheet title={packFor.name} onClose={() => setPackFor(null)}>
          <p className="text-sm text-cool">{packFor.tagline} 10 seconds a question.</p>
          <div className="mt-5 grid gap-3">
            <button
              onClick={() => {
                setSoloPack(packFor);
                setPackFor(null);
              }}
              className="rounded-full py-3.5 font-semibold"
              style={{ background: "var(--bg-surface)" }}
            >
              Play solo
            </button>
            {live ? (
              <button
                onClick={() => {
                  setChallengePack(packFor);
                  setPackFor(null);
                }}
                className="rounded-full py-3.5 btn-bronze"
              >
                Challenge someone from your 25
              </button>
            ) : (
              <Link to="/login" className="rounded-full py-3.5 btn-bronze text-center">
                Sign in to challenge a friend
              </Link>
            )}
          </div>
        </Sheet>
      )}
      {soloPack && <TriviaGame pack={soloPack} onClose={() => setSoloPack(null)} />}
      {challengePack && (
        <FriendPicker
          title="who are you challenging?"
          cta="Challenge"
          single
          onClose={() => setChallengePack(null)}
          onPick={async ([fid]) => {
            const friend = friendById(fid);
            const pack = challengePack;
            setChallengePack(null);
            if (!friend) return;
            try {
              const id = await startTriviaChallenge(pack.id, friend);
              navigate({ to: "/app/play/$id", params: { id } });
            } catch (e) {
              setToast((e as Error).message);
            }
          }}
        />
      )}

      {arcade === "tap-rush" && <TapRush onClose={() => setArcade(null)} />}
      {arcade === "quick-math" && <QuickMath onClose={() => setArcade(null)} />}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </>
  );
}
