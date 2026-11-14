/**
 * A small liquid-glass menu that pops up next to what you tapped (a face at the
 * Table, the Feed's "+"): a list of actions with icons. Closes on outside tap or Escape.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

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
        className="lg lg-menu absolute p-1.5 rounded-[24px] animate-soft-in"
        style={{
          width: 260,
          left: pos?.left ?? -9999,
          top: pos?.top ?? -9999,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {header && (
          <div
            className="px-2.5 pt-2 pb-2"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
          >
            {header}
          </div>
        )}
        <div className="grid grid-cols-[minmax(0,1fr)] py-1 min-w-0">
          {items.map((it) => (
            <button
              key={it.key}
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                if (it.disabled) return;
                it.onSelect?.();
              }}
              className="menu-row w-full min-w-0 flex items-center gap-3 rounded-[16px] px-2.5 py-2 text-left disabled:opacity-45"
            >
              <span
                className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "var(--lime)",
                }}
                aria-hidden="true"
              >
                {it.icon}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold leading-tight truncate">
                  {it.label}
                </span>
                {it.hint && (
                  <span
                    className="block text-[12px] leading-tight truncate"
                    style={{ color: "var(--ink-3)" }}
                  >
                    {it.hint}
                  </span>
                )}
              </span>
              {!it.disabled && (
                <ChevronRight
                  size={16}
                  className="shrink-0"
                  style={{ color: "var(--ink-3)" }}
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
