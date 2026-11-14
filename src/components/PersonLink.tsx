/**
 * Makes a face or name tappable anywhere: you → your profile, someone in your
 * 25 → their seat page, anyone else → their public card.
 */
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { friendById } from "@/lib/social";

export function PersonLink({
  id,
  username,
  children,
  className,
  label,
}: {
  id: string;
  username?: string | null;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const cls = className ?? "inline-flex items-center shrink-0";
  if (id === "me")
    return (
      <Link to="/app/profile" className={cls} onClick={stop} aria-label={label}>
        {children}
      </Link>
    );
  const friend = friendById(id);
  if (friend)
    return (
      <Link to="/app/seat/$id" params={{ id }} className={cls} onClick={stop} aria-label={label}>
        {children}
      </Link>
    );
  const handle = username ?? undefined;
  if (handle)
    return (
      <Link
        to="/in/$username"
        params={{ username: handle }}
        className={cls}
        onClick={stop}
        aria-label={label}
      >
        {children}
      </Link>
    );
  return <span className={cls}>{children}</span>;
}
