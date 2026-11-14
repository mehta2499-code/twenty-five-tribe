/** "People you may know", Instagram style: who seated you, then mutual connections, quiz links, friends of friends, newcomers. */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { account, type Suggestion } from "@/lib/live";
import { useSocial } from "@/lib/social";

const HIDDEN = "tf.sugg.hidden";
const readHidden = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN) ?? "[]");
  } catch {
    return [];
  }
};

export function useSuggestions(includeNew = false) {
  const s = useSocial();
  const [list, setList] = useState<Suggestion[] | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const key = `${s.me?.id}:${s.people.length}`;
  useEffect(() => {
    setHidden(readHidden());
    if (s.mode !== "live" || !s.me) return;
    void account.suggestions(includeNew).then(setList, () => setList([]));
  }, [key, s.mode, includeNew]);
  const hide = (id: string) => {
    const next = [...hidden, id];
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN, JSON.stringify(next.slice(-200)));
    } catch {
      // ignore
    }
  };
  return { list: (list ?? []).filter((p) => !hidden.includes(p.id)), loaded: list !== null, hide };
}

/** Instagram-style reason: "Seated you", "Seated by Priya + 2 more", … */
function line(p: Suggestion) {
  if (p.reason === "seated_you") return "Seated you";
  if (p.reason === "mutuals" && p.via.length) {
    const more = p.mutuals - 1;
    return `Seated by ${p.via[0].name}${more > 0 ? ` + ${more} more` : ""}`;
  }
  if (p.reason === "quiz") return "Took your quiz";
  if (p.reason === "friends") return "Friend of a friend";
  return "New on 25";
}

export function SuggestionCards({
  title = "People you may know",
  onPick,
  max = 20,
  includeNew = false,
}: {
  /** Also show newcomers (the Add page always does). */
  includeNew?: boolean;
  title?: string;
  /** Default: open their card to prove you know them. */
  onPick?: (p: Suggestion) => void;
  max?: number;
}) {
  const { list, loaded, hide } = useSuggestions(includeNew);
  if (!loaded || list.length === 0) return null;
  return (
    <section className="mt-6" aria-label={title}>
      <h2 className="px-5 heading" style={{ fontSize: 18 }}>
        {title}
      </h2>
      <ul className="mt-3 flex gap-3 overflow-x-auto px-5 pb-2 no-scrollbar">
        {list.slice(0, max).map((p) => {
          const body = (
            <>
              <Avatar src={p.avatar || undefined} initials={p.initials} color={p.color} size={64} />
              <span className="mt-2 font-bold text-cream text-[14px] truncate w-full">
                {p.name.split(" ")[0]}
              </span>
              <span className="meta truncate w-full" style={{ fontSize: 11.5 }}>
                @{p.username}
              </span>
              <span
                className="meta mt-1 leading-tight flex items-center justify-center gap-1 h-[2.4em]"
                style={{ fontSize: 11.5 }}
              >
                {p.via.length > 0 && (
                  <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">
                    {p.via.map((v, i) => (
                      <span
                        key={i}
                        className="rounded-full"
                        style={{ border: "1.5px solid var(--surface)" }}
                      >
                        <Avatar src={v.avatar || undefined} initials={v.name[0]} size={16} />
                      </span>
                    ))}
                  </span>
                )}
                <span className="line-clamp-2 text-left">{line(p)}</span>
              </span>
              <span className="btn-primary mt-2 w-full min-h-[34px] text-[13px]">
                {p.reason === "seated_you" ? "Seat back" : "Prove it"}
              </span>
            </>
          );
          return (
            <li key={p.id} className="relative shrink-0 w-[136px]">
              {onPick ? (
                <button
                  onClick={() => onPick(p)}
                  className="card w-full p-3 flex flex-col items-center text-center"
                >
                  {body}
                </button>
              ) : (
                <Link
                  to="/in/$username"
                  params={{ username: p.username ?? "" }}
                  className="card w-full p-3 flex flex-col items-center text-center"
                >
                  {body}
                </Link>
              )}
              <button
                onClick={() => hide(p.id)}
                aria-label={`Hide ${p.name}`}
                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center text-faint"
              >
                <X size={14} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
