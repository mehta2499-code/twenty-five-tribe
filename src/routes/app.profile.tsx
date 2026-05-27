import { createFileRoute, Link } from "@tanstack/react-router";
import { Avatar } from "@/components/Avatar";
import { ME, SEATS_FILLED, SEATS_TOTAL } from "@/lib/data";

export const Route = createFileRoute("/app/profile")({
  component: Profile,
});

const ITEMS = [
  { label: "Memory Capsules", note: "Save a Moment forever." },
  { label: "Privacy", note: "Everything here is private. Promise." },
  { label: "Notifications", note: "Only when it matters." },
  { label: "Reshuffle your 25", note: "It's allowed. Encouraged, even." },
];

function Profile() {
  return (
    <div className="px-5 pt-8 pb-4">
      <div className="flex flex-col items-center text-center">
        <Avatar src={ME.avatar} initials={ME.initials} size={88} />
        <h1 className="mt-4 text-xl font-bold">You</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {SEATS_FILLED} of {SEATS_TOTAL} seats filled
        </p>
      </div>

      <div className="mt-8 rounded-2xl bg-card border border-border divide-y divide-border">
        {ITEMS.map((i) => (
          <button key={i.label} className="w-full text-left px-4 py-4 hover:bg-surface-2 transition">
            <div className="text-sm font-semibold">{i.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{i.note}</div>
          </button>
        ))}
      </div>

      <Link
        to="/"
        className="block text-center text-xs text-muted-foreground mt-8 underline-offset-4 hover:underline"
      >
        Sign out
      </Link>
      <p className="text-center text-[10px] text-muted-foreground/60 mt-6">
        No followers. No likes. Just 25 humans.
      </p>
    </div>
  );
}
