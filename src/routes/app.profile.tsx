import { DeleteAccount } from "@/components/Safety";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { ME, SEATS_TOTAL, ME_DESCRIPTIONS, QUIETLY } from "@/lib/data";
import { fileToImage, seatedFriends, useSocial } from "@/lib/social";
import { useRef, useState } from "react";
import { account } from "@/lib/live";
import { VOICE } from "@/lib/copy";
import { PageBand } from "@/components/SocialUI";
import { ShareCard } from "@/components/ShareCard";

export const Route = createFileRoute("/app/profile")({
  component: Profile,
});

// Uppercase and letter-spacing come from the .label-caps style.
function spaced(s: string) {
  return s;
}

type Item = {
  label: string;
  note: string;
  to: "/app/privacy" | "/app/people" | "/vibe";
  live: boolean; // available with your real 25 (the rest are demo-only for now)
};
const ITEMS: Item[] = [
  {
    label: "Your 25",
    note: "Seat people, seat back, free a seat.",
    to: "/app/people",
    live: true,
  },
  {
    label: "Vibe check",
    note: "Change your this-or-that answers and birthday.",
    to: "/vibe",
    live: true,
  },
  {
    label: "Privacy",
    note: "Screenshots, screen recording, blur.",
    to: "/app/privacy",
    live: true,
  },
];

function HowTheySeeYou() {
  return (
    <section className="mt-9">
      <p className="label-caps text-center">{spaced(VOICE.you.seeingMe)}</p>
      <ul className="mt-5 space-y-4">
        {ME_DESCRIPTIONS.map((d, i) => (
          <li key={i} className="text-center px-4">
            <p
              className="font-display italic text-cream"
              style={{ fontSize: 19, lineHeight: 1.45, letterSpacing: "-0.01em" }}
            >
              "{d.quote}"
            </p>
            <p
              className="font-display italic mt-1"
              style={{ color: "var(--text-muted)", fontSize: 12 }}
            >
              — {d.from}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function QuietlyHappening() {
  const items = [
    { n: QUIETLY.momentsThisMonth, label: "moments this month" },
    { n: QUIETLY.thoughtsExchanged, label: "thoughts exchanged" },
    { n: QUIETLY.verdictsCast, label: "verdicts cast" },
  ];
  return (
    <section className="mt-10">
      <p className="label-caps text-center mb-5">{spaced(VOICE.you.quietly)}</p>
      <div className="grid grid-cols-3 gap-2">
        {items.map((i) => (
          <div key={i.label} className="text-center">
            <div className="font-display text-cream" style={{ fontSize: 32, lineHeight: 1 }}>
              {i.n}
            </div>
            <div
              className="font-display italic mt-1.5"
              style={{ color: "var(--text-muted)", fontSize: 11, lineHeight: 1.3 }}
            >
              {i.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Profile() {
  const s = useSocial();
  const name = s.me?.name ?? ME.name;
  const taken = seatedFriends().length;
  const live = s.mode === "live";
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoState, setPhotoState] = useState<string | null>(null);
  const [confirmOut, setConfirmOut] = useState(false);
  const changePhoto = async (file?: File) => {
    if (!file) return;
    setPhotoState("Uploading…");
    try {
      await account.updateAvatar(await fileToImage(file, 600));
      setPhotoState("Photo updated.");
    } catch (e) {
      setPhotoState((e as Error).message);
    }
  };
  return (
    <div className="pb-6">
      <PageBand title="You" back />
      <section className="px-5 flex items-center gap-4">
        <div className="relative shrink-0">
          <Avatar
            src={s.me ? s.me.avatar : ME.avatar}
            initials={s.me?.initials ?? ME.initials}
            size={84}
          />
        </div>
        <div className="min-w-0">
          <p className="heading truncate">{name}</p>
          {s.me && <p className="meta truncate">@{s.me.username}</p>}
          <p className="text-cool mt-1" style={{ fontSize: 14 }}>
            {taken} of {SEATS_TOTAL} seats filled
          </p>
          {live && (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                className="mt-2 text-sm font-semibold text-bronze py-1"
              >
                {s.me?.avatar ? "Change photo" : "Add a photo"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => void changePhoto(e.target.files?.[0])}
              />
            </>
          )}
        </div>
      </section>
      {photoState && (
        <p className="px-5 mt-2 text-sm text-cool" role="status">
          {photoState}
        </p>
      )}

      {live && s.me?.vibeDone && (
        <div className="mt-6">
          <ShareCard />
        </div>
      )}

      {!live && (
        <>
          <div className="hairline mx-8 mt-8" />
          <HowTheySeeYou />
          <div className="hairline mx-8 mt-10" />
          <QuietlyHappening />
        </>
      )}

      <ul
        className="mx-5 mt-8 card overflow-hidden divide-y"
        style={{ borderColor: "var(--line)" }}
      >
        {ITEMS.filter((i) => !live || i.live).map((i) => (
          <li key={i.label}>
            <Link
              to={i.to}
              className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-[var(--fill)]"
            >
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-cream" style={{ fontSize: 15 }}>
                  {i.label}
                </span>
                <span className="block meta mt-0.5">{i.note}</span>
              </span>
              <ChevronRight size={18} className="text-faint shrink-0" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="px-5 mt-8">
        {live ? (
          confirmOut ? (
            <div className="card p-4" role="alertdialog" aria-label="Sign out">
              <p className="font-semibold text-cream">Sign out of 25 on this device?</p>
              <p className="meta mt-1">
                Your chats, posts and 25 stay saved. Sign back in any time with your email.
              </p>
              <div className="mt-4 flex gap-2">
                <button onClick={() => setConfirmOut(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button onClick={() => void account.signOut()} className="btn-danger flex-1">
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmOut(true)}
              className="btn-secondary w-full"
              style={{ color: "var(--coral-deep)" }}
            >
              Sign out
            </button>
          )
        ) : (
          <Link to="/login" className="btn-primary w-full">
            Sign in to use 25 with real friends
          </Link>
        )}
        <DeleteAccount />
      </div>
      <p className="text-center meta mt-6">{VOICE.you.footer}</p>
    </div>
  );
}
