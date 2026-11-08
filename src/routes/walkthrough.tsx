import { takePendingPath } from "@/lib/pending";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/walkthrough")({
  component: Walkthrough,
});

const CARDS = [
  {
    eyebrow: "the truth",
    title: "You have thousands of contacts.",
    body: "Very few are your people.",
  },
  {
    eyebrow: "the rule",
    title: "On 25, you only get 25 seats.",
    body: "Choose carefully.",
  },
  {
    eyebrow: "the point",
    title: "Share moments, thoughts and memories with the people who matter most.",
    body: "Seat anyone you know. Mutual seats unlock chats and blinks. No strangers, ever.",
  },
];

function Walkthrough() {
  const [i, setI] = useState(0);
  const navigate = useNavigate();
  const last = i === CARDS.length - 1;

  const next = () => {
    if (last) {
      try {
        localStorage.setItem("tf.walkthrough.done", "1");
      } catch {}
      navigate({ to: (takePendingPath() ?? "/app/home") as "/app/home" });
    } else {
      setI(i + 1);
    }
  };

  const skip = () => {
    try {
      localStorage.setItem("tf.walkthrough.done", "1");
    } catch {}
    navigate({ to: (takePendingPath() ?? "/app/home") as "/app/home" });
  };

  const card = CARDS[i];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex justify-between items-center px-6 pt-6">
        <div className="flex gap-1.5">
          {CARDS.map((_, idx) => (
            <span
              key={idx}
              style={{
                width: idx === i ? 22 : 6,
                height: 6,
                borderRadius: 999,
                background: idx <= i ? "var(--accent-bronze)" : "rgba(181,219,94,0.22)",
                transition: "all 280ms ease",
              }}
            />
          ))}
        </div>
        <button onClick={skip} className="label-caps text-cool">
          skip
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <p className="label-caps mb-6">{card.eyebrow}</p>
        <h1 className="chalk-title" style={{ fontSize: 38, maxWidth: "20rem" }}>
          {/* Underline the last word, in lime. */}
          {card.title.split(" ").slice(0, -1).join(" ")}{" "}
          <span className="chalk-lime chalk-underline">{card.title.split(" ").slice(-1)[0]}</span>
        </h1>
        <p
          className="font-display italic mt-6 mx-auto"
          style={{ color: "var(--text-muted)", fontSize: 16, lineHeight: 1.5, maxWidth: "18rem" }}
        >
          {card.body}
        </p>
      </div>

      <div className="px-8 pb-12 pt-6">
        <button
          onClick={next}
          className="w-full rounded-full py-4 font-display italic active:scale-[0.99] transition"
          style={{
            background: "var(--accent-bronze)",
            color: "var(--bg-primary)",
            fontSize: 15,
            letterSpacing: "0.02em",
          }}
        >
          {last ? "Enter the table" : "Continue"}
        </button>
      </div>
    </div>
  );
}
