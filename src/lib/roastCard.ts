/**
 * Roast cards: a picture to go with a roast post in Scenes. Drawn on the phone
 * (canvas), one look per game: its colours, its art, its own punchline.
 */
import { createElement } from "react";
import { GameArt, type ArtKind } from "@/components/GameArt";

export type RoastFace = { name: string; avatar?: string; initials: string };
export type RoastCardInput = {
  game: string;
  detail?: string;
  winner: RoastFace;
  losers: RoastFace[];
  /** Winner's and runner-up's scores, when the game has points. */
  score?: [number, number];
};

type Theme = {
  art: ArtKind;
  from: string;
  to: string;
  ink: string;
  lines: string[];
  /** How the game's name reads on the card, if not as given. */
  label?: string;
};
const THEMES: Record<string, Theme> = {
  ludo: {
    art: "ludo",
    from: "#FFCF4D",
    to: "#F2506A",
    ink: "#2A0E14",
    lines: ["Sent home. 🏠", "Back to start, buddy.", "Rolled over them. 🎲"],
  },
  trivia: {
    art: "trivia",
    from: "#8B6CFF",
    to: "#2E1F8F",
    ink: "#fff",
    lines: ["Big brain energy. 🧠", "Knew every answer.", "Read a book sometime. 📚"],
  },
  judgement: {
    art: "kachuful",
    from: "#3D8BFF",
    to: "#122A66",
    ink: "#fff",
    lines: ["Called every hand. 🃏", "Bid it. Made it.", "Read them like a deck."],
  },
  chess: {
    art: "chess",
    from: "#9BC26B",
    to: "#2F4A22",
    ink: "#fff",
    lines: ["Checkmate. ♟️", "Saw it ten moves ago.", "Resign next time. 👑"],
  },
  poker: {
    label: "Hold'em",
    art: "poker",
    from: "#1FA35F",
    to: "#062A17",
    ink: "#fff",
    lines: ["Took all the chips. 💰", "All in. All mine.", "Nice bluff. Didn't work. 😏"],
  },
  "name that tune": {
    art: "earworm",
    from: "#F2507B",
    to: "#3A1A6B",
    ink: "#fff",
    lines: ["Knew it in one second. 🎧", "Name that loss. 🎶", "Ears of gold. 👂"],
  },
};
const fallback: Theme = {
  art: "mystery",
  from: "#FF7A45",
  to: "#7A1F3D",
  ink: "#fff",
  lines: ["Took the W. 🏆"],
};
export const themeFor = (game: string) => THEMES[game.toLowerCase()] ?? fallback;

const W = 1080;
const H = 1350;

function loadImage(src: string, cors = true): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** The game's sticker art as an image (it's an SVG component). */
async function artImage(kind: ArtKind) {
  const { renderToStaticMarkup } = await import("react-dom/server");
  let svg = renderToStaticMarkup(createElement(GameArt, { kind, size: 512 }));
  if (!svg.includes("xmlns=")) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, false);
}

const FONT = `-apple-system, "SF Pro Display", "Inter", system-ui, sans-serif`;

/** A face in a circle: their photo, or their initials if it won't load. */
async function face(
  c: CanvasRenderingContext2D,
  p: RoastFace,
  x: number,
  y: number,
  r: number,
  opts: { ring: string; ringW: number; dim?: boolean },
) {
  const img = p.avatar ? await loadImage(p.avatar) : null;
  c.save();
  c.beginPath();
  c.arc(x, y, r + opts.ringW, 0, Math.PI * 2);
  c.fillStyle = opts.ring;
  c.fill();
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.clip();
  if (img) {
    const s = Math.max((2 * r) / img.width, (2 * r) / img.height);
    c.drawImage(
      img,
      x - (img.width * s) / 2,
      y - (img.height * s) / 2,
      img.width * s,
      img.height * s,
    );
  } else {
    const g = c.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, "#3A3550");
    g.addColorStop(1, "#1B1826");
    c.fillStyle = g;
    c.fillRect(x - r, y - r, 2 * r, 2 * r);
    c.fillStyle = "#fff";
    c.font = `800 ${Math.round(r * 0.75)}px ${FONT}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(p.initials.slice(0, 2).toUpperCase(), x, y + r * 0.04);
  }
  if (opts.dim) {
    c.fillStyle = "rgba(10,8,16,0.45)";
    c.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  c.restore();
}

function sticker(
  c: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  bg: string,
  fg: string,
  tilt: number,
) {
  c.save();
  c.translate(x, y);
  c.rotate(tilt);
  c.font = `900 ${size}px ${FONT}`;
  const w = c.measureText(text).width + size * 1.1;
  const h = size * 1.6;
  c.fillStyle = "#0B0A10";
  roundRect(c, -w / 2, -h / 2 + 8, w, h, h / 2.6);
  c.fill();
  c.fillStyle = bg;
  roundRect(c, -w / 2, -h / 2, w, h, h / 2.6);
  c.fill();
  c.lineWidth = 6;
  c.strokeStyle = "#0B0A10";
  c.stroke();
  c.fillStyle = fg;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(text, 0, 2);
  c.restore();
}

function roundRect(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Shrink the font until the text fits the width. */
function fit(c: CanvasRenderingContext2D, text: string, max: number, size: number, weight = 900) {
  let s = size;
  c.font = `${weight} ${s}px ${FONT}`;
  while (c.measureText(text).width > max && s > 24) {
    s -= 4;
    c.font = `${weight} ${s}px ${FONT}`;
  }
  return s;
}

/** Draw the card. Returns a local image link (blob:) for the post. */
export async function makeRoastCard(input: RoastCardInput, variant = 0): Promise<string | null> {
  try {
    const t = themeFor(input.game);
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const c = cv.getContext("2d");
    if (!c) return null;

    // Background: the game's colours, with sunburst rays.
    const bg = c.createLinearGradient(0, 0, W * 0.4, H);
    bg.addColorStop(0, t.from);
    bg.addColorStop(1, t.to);
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);
    c.save();
    c.translate(W / 2, 560);
    for (let i = 0; i < 24; i++) {
      c.rotate((Math.PI * 2) / 24);
      if (i % 2) continue;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(-90, -1400);
      c.lineTo(90, -1400);
      c.closePath();
      c.fillStyle = "rgba(255,255,255,0.06)";
      c.fill();
    }
    c.restore();
    // Confetti-ish shapes.
    const shapes: [number, number, number, number][] = [
      [90, 260, 70, 0.3],
      [980, 330, 50, -0.4],
      [140, 1010, 46, 0.7],
      [950, 960, 64, 0.2],
    ];
    for (const [x, y, s, r] of shapes) {
      c.save();
      c.translate(x, y);
      c.rotate(r);
      c.fillStyle = "rgba(255,255,255,0.14)";
      roundRect(c, -s / 2, -s / 2, s, s, s / 4);
      c.fill();
      c.restore();
    }

    // The game's art, big, behind the winner's head.
    const art = await artImage(t.art);
    if (art) {
      c.save();
      c.globalAlpha = 0.95;
      c.translate(W - 210, 250);
      c.rotate(0.18);
      c.drawImage(art, -150, -150, 300, 300);
      c.restore();
    }

    // Top stickers.
    sticker(c, "ROASTED 🔥", 260, 120, 54, "#fff", "#0B0A10", -0.06);
    c.fillStyle = t.ink;
    c.globalAlpha = 0.85;
    c.font = `800 38px ${FONT}`;
    c.textAlign = "left";
    c.fillText(
      `${t.label ?? input.game}${input.detail ? ` · ${input.detail}` : ""}`.slice(0, 40),
      80,
      230,
    );
    c.globalAlpha = 1;

    // The winner, crowned.
    const cx = W / 2;
    const cy = 520;
    c.save();
    c.shadowColor = "rgba(0,0,0,0.35)";
    c.shadowBlur = 50;
    c.shadowOffsetY = 20;
    c.beginPath();
    c.arc(cx, cy, 190, 0, Math.PI * 2);
    c.fillStyle = "#F7C948";
    c.fill();
    c.restore();
    await face(c, input.winner, cx, cy, 172, { ring: "#F7C948", ringW: 18 });
    c.font = `120px ${FONT}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("👑", cx, cy - 230);

    const first = (n: string) => n.split(" ")[0];
    c.fillStyle = t.ink;
    c.textBaseline = "alphabetic";
    const size = fit(c, first(input.winner.name).toUpperCase(), W - 160, 110);
    c.font = `900 ${size}px ${FONT}`;
    c.fillText(first(input.winner.name).toUpperCase(), cx, 820);

    // Who they beat.
    c.globalAlpha = 0.8;
    c.font = `800 40px ${FONT}`;
    c.fillText("just beat", cx, 885);
    c.globalAlpha = 1;
    const losers = input.losers.slice(0, 4);
    const r = losers.length > 2 ? 62 : 78;
    const gap = r * 2 + 70;
    const startX = cx - ((losers.length - 1) * gap) / 2;
    for (let i = 0; i < losers.length; i++) {
      const x = startX + i * gap;
      await face(c, losers[i], x, 990, r, { ring: "rgba(255,255,255,0.85)", ringW: 7, dim: true });
      c.font = `${Math.round(r * 0.7)}px ${FONT}`;
      c.textBaseline = "middle";
      c.fillText("💀", x + r * 0.72, 990 + r * 0.7);
      c.textBaseline = "alphabetic";
      c.fillStyle = t.ink;
      const s = fit(c, first(losers[i].name), gap - 16, 34, 800);
      c.font = `800 ${s}px ${FONT}`;
      c.fillText(first(losers[i].name), x, 990 + r + 52);
    }

    // The score and the punchline.
    const line = t.lines[variant % t.lines.length];
    let y = 1190;
    if (input.score) {
      c.font = `900 64px ${FONT}`;
      c.fillText(`${input.score[0]} – ${input.score[1]}`, cx, y);
      y += 70;
    }
    sticker(c, line, cx, input.score ? y - 6 : y + 10, 44, "#F7C948", "#0B0A10", 0.03);

    // Footer.
    c.globalAlpha = 0.65;
    c.font = `800 30px ${FONT}`;
    c.fillStyle = t.ink;
    c.textAlign = "right";
    c.fillText("the 25", W - 50, H - 34);
    c.globalAlpha = 1;

    const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, "image/jpeg", 0.9));
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    // e.g. a photo that wouldn't let itself be drawn: post without the card.
    return null;
  }
}
