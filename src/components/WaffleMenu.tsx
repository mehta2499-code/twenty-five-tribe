/**
 * A small liquid-glass menu of icon tiles that pops up next to what you tapped
 * (a face at the Table, the Feed's "+"). Closes on outside tap or Escape.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type WaffleItem = {
  key: string;
  icon: ReactNode;
  label: string;
  hint?: string;
  disabled?: boolean;
  onSelect?: () => void;
};

export function WaffleMenu({
  anchor,
  header,
  items,
  onClose,
  label,
}: {
  /** Screen rect of what was tapped; the menu sits just below (or above) it. */
  anchor: DOMRect;
  header?: ReactNode;
  items: WaffleItem[];
  onClose: () => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = anchor.left + anchor.width / 2 - w / 2;
    left = Math.max(12, Math.min(vw - w - 12, left));
    let top = anchor.bottom + 10;
    if (top + h > vh - 100) top = anchor.top - h - 10;
    top = Math.max(12, top);
    setPos({ left, top });
  }, [anchor, items.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80]" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(7,6,11,0.35)" }} />
      <div
        ref={ref}
        role="menu"
        aria-label={label}
        className="liquid absolute p-2.5 rounded-[26px] animate-soft-in"
        style={{
          width: 236,
          left: pos?.left ?? -9999,
          top: pos?.top ?? -9999,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {header && <div className="px-1.5 pt-1 pb-2.5">{header}</div>}
        <div className="grid grid-cols-2 gap-2">
          {items.map((it) => (
            <button
              key={it.key}
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                if (it.disabled) return;
                it.onSelect?.();
              }}
              className="liquid-tile flex flex-col items-center justify-center gap-1 rounded-[18px] py-3 px-1 text-center disabled:opacity-45"
            >
              <span className="text-[24px] leading-none" aria-hidden="true">
                {it.icon}
              </span>
              <span className="text-[13px] font-bold leading-tight">{it.label}</span>
              {it.hint && <span className="text-[10.5px] opacity-70 leading-tight">{it.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
