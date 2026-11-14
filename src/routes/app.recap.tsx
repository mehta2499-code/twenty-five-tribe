/**
 * Monthly Drop recap: your month in Drops, a few stats, and a card to share.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Heart, Share2, Timer, Camera } from "lucide-react";
import { PageBand, Toast, clientOnly } from "@/components/SocialUI";
import { useSocial } from "@/lib/social";
import { today } from "@/lib/daily";
import {
  addMonths,
  defaultRecapMonth,
  loadRecap,
  monthKey,
  monthName,
  type Recap,
} from "@/lib/drop";

export const Route = createFileRoute("/app/recap")({
  head: () => ({ meta: [{ title: "Drop recap · 25" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    m: typeof s.m === "string" && /^\d{4}-\d{2}$/.test(s.m) ? s.m : undefined,
  }),
  component: clientOnly(RecapScreen),
});

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

function RecapScreen() {
  const s = useSocial();
  const { m } = Route.useSearch();
  const navigate = Route.useNavigate();
  const month = m ?? defaultRecapMonth();
  const [recap, setRecap] = useState<Recap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    setRecap(null);
    setError(null);
    loadRecap(month).then(setRecap, (e) => setError((e as Error).message));
  }, [month, s.mode]);

  const go = (n: number) => navigate({ search: { m: addMonths(month, n) } });
  const isCurrent = month >= monthKey(today());

  const share = async () => {
    if (!recap) return;
    setSharing(true);
    try {
      const blob = await drawCard(recap, s.me?.name.split(" ")[0] ?? "Me");
      const file = new File([blob], `25-drop-${month}.png`, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], text: `My ${monthName(month)} on 25 📸 the25.world` });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        setToast("Saved your recap image");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setToast("Couldn't make the image. Try again.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="pb-10">
      <PageBand title={`${monthName(month)} recap`} sub="Your month in Drops." back />

      <div className="px-5 flex items-center justify-between">
        <button onClick={() => go(-1)} className="btn-quiet btn-icon" aria-label="Previous month">
          <ChevronLeft size={20} />
        </button>
        <span className="font-bold">{monthName(month, true)}</span>
        <button
          onClick={() => go(1)}
          disabled={isCurrent}
          className="btn-quiet btn-icon disabled:opacity-30"
          aria-label="Next month"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {error && <p className="px-5 mt-6 meta text-center">{error}</p>}
      {!recap && !error && <p className="px-5 mt-10 meta text-center">Loading…</p>}

      {recap && (
        <>
          <section className="px-5 mt-4 grid grid-cols-2 gap-3">
            <Stat
              icon={Camera}
              big={`${recap.days.length}`}
              small={`of ${recap.daysSoFar || recap.daysInMonth} days dropped`}
              accent
            />
            <Stat icon={Flame} big={`${recap.longestStreak}`} small="day best streak" />
            <Stat icon={Timer} big={`${recap.onTime}`} small={`on time · ${recap.late} late`} />
            <Stat icon={Heart} big={`${recap.reactions}`} small="likes + comments" />
          </section>

          <section className="px-5 mt-6" aria-label="Calendar">
            <div className="grid grid-cols-7 gap-1.5 text-center meta" style={{ fontSize: 11 }}>
              {WEEK.map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <Calendar recap={recap} />
          </section>

          {recap.best && recap.best.likes + recap.best.comments > 0 && (
            <section className="px-5 mt-7">
              <h2 className="heading" style={{ fontSize: 18 }}>
                Your most-loved Drop
              </h2>
              <div className="mt-3 card overflow-hidden">
                <img
                  src={recap.best.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full aspect-[4/5] object-cover"
                />
                <p className="p-3 meta">
                  {new Date(`${recap.best.day}T00:00:00Z`).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  })}
                  {recap.best.caption ? ` · ${recap.best.caption}` : ""} · ❤️ {recap.best.likes} ·
                  💬 {recap.best.comments}
                </p>
              </div>
            </section>
          )}

          {recap.days.length > 0 ? (
            <div className="px-5 mt-7">
              <button
                onClick={() => void share()}
                disabled={sharing}
                className="btn-primary w-full"
              >
                <Share2 size={18} aria-hidden="true" />{" "}
                {sharing ? "Making your card…" : "Share my recap"}
              </button>
            </div>
          ) : (
            <p className="px-5 mt-8 meta text-center">
              No Drops this month.{" "}
              <Link to="/app/drop" className="underline underline-offset-4">
                Catch the next one
              </Link>
            </p>
          )}
        </>
      )}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

function Stat({
  icon: Icon,
  big,
  small,
  accent,
}: {
  icon: typeof Camera;
  big: string;
  small: string;
  accent?: boolean;
}) {
  return (
    <div className="card p-3.5">
      <Icon
        size={18}
        aria-hidden="true"
        style={{ color: accent ? "var(--lime)" : "var(--ink-3)" }}
      />
      <p
        className="display tabular-nums mt-1"
        style={{ fontSize: 30, lineHeight: 1, color: accent ? "var(--lime)" : undefined }}
      >
        {big}
      </p>
      <p className="meta mt-1" style={{ fontSize: 12.5 }}>
        {small}
      </p>
    </div>
  );
}

function Calendar({ recap }: { recap: Recap }) {
  const [y, m] = recap.month.split("-").map(Number);
  const firstWeekday = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const byDay = new Map(recap.days.map((d) => [Number(d.day.slice(8, 10)), d]));
  return (
    <div className="mt-1.5 grid grid-cols-7 gap-1.5">
      {Array.from({ length: firstWeekday }).map((_, i) => (
        <span key={`e${i}`} />
      ))}
      {Array.from({ length: recap.daysInMonth }).map((_, i) => {
        const n = i + 1;
        const d = byDay.get(n);
        const future = recap.daysSoFar > 0 && n > recap.daysSoFar;
        return (
          <span
            key={n}
            className="relative aspect-square rounded-lg overflow-hidden flex items-center justify-center"
            style={{
              background: "var(--fill)",
              opacity: future ? 0.35 : 1,
              outline: d && d.late > 0 ? "2px solid var(--sun)" : undefined,
            }}
          >
            {d?.image ? (
              <img
                src={d.image}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : null}
            <span
              className="relative text-[10px] font-bold"
              style={{
                color: d ? "#fff" : "var(--ink-3)",
                textShadow: d ? "0 1px 2px rgba(0,0,0,0.8)" : undefined,
              }}
            >
              {n}
            </span>
          </span>
        );
      })}
    </div>
  );
}

// ---------- Share card ----------

function loadImg(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function cover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const r = Math.max(w / img.width, h / img.height);
  const sw = w / r;
  const sh = h / r;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

async function drawCard(recap: Recap, name: string): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#0B0A0F";
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, -100, 50, W / 2, -100, 900);
  glow.addColorStop(0, "rgba(193,239,98,0.25)");
  glow.addColorStop(1, "rgba(193,239,98,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const sans = getComputedStyle(document.body).fontFamily;
  ctx.fillStyle = "#C1EF62";
  ctx.font = `800 40px ${sans}`;
  ctx.fillText("THE 25 DROP", 80, 120);
  ctx.fillStyle = "#F5F1FA";
  ctx.font = `800 84px ${sans}`;
  ctx.fillText(`${name}'s ${monthName(recap.month)}`, 80, 215);

  // Up to 9 photos, most-loved first.
  const pics = [...recap.days]
    .filter((d) => d.image)
    .sort((a, b) => b.likes + b.comments - (a.likes + a.comments))
    .slice(0, 9);
  const imgs = await Promise.all(pics.map((d) => loadImg(d.image)));
  const gap = 14;
  const cell = (W - 160 - gap * 2) / 3;
  imgs.forEach((img, i) => {
    const x = 80 + (i % 3) * (cell + gap);
    const y = 270 + Math.floor(i / 3) * (cell + gap);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, cell, cell, 22);
    ctx.clip();
    ctx.fillStyle = "#24212D";
    ctx.fillRect(x, y, cell, cell);
    if (img) cover(ctx, img, x, y, cell, cell);
    ctx.restore();
  });

  const stats: [string, string][] = [
    [`${recap.days.length}`, "Drops"],
    [`${recap.longestStreak}`, "best streak"],
    [`${recap.onTime}`, "on time"],
    [`${recap.reactions}`, "reactions"],
  ];
  const sy = 270 + 3 * (cell + gap) + 70;
  stats.forEach(([big, small], i) => {
    const x = 80 + i * 235;
    ctx.fillStyle = i === 0 ? "#C1EF62" : "#F5F1FA";
    ctx.font = `800 76px ${sans}`;
    ctx.fillText(big, x, sy);
    ctx.fillStyle = "rgba(245,241,250,0.65)";
    ctx.font = `600 30px ${sans}`;
    ctx.fillText(small, x, sy + 44);
  });

  ctx.fillStyle = "rgba(245,241,250,0.55)";
  ctx.font = `600 30px ${sans}`;
  ctx.fillText("the25.world · everyone else is noise", 80, H - 70);

  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("no image"))), "image/png"),
  );
}
