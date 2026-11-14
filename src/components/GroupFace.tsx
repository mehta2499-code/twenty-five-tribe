/** A group's photo, or its emoji when it has none. */
export function GroupFace({
  avatar,
  emoji,
  size,
}: {
  avatar?: string;
  emoji: string;
  size: number;
}) {
  return (
    <span
      className="rounded-full flex items-center justify-center shrink-0 overflow-hidden"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.48,
        background: "var(--fill)",
        border: "var(--bd)",
      }}
    >
      {avatar ? (
        <img
          src={avatar}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
        />
      ) : (
        emoji
      )}
    </span>
  );
}
