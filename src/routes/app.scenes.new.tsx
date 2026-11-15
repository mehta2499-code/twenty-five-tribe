/**
 * New scene: a full page (not a pop-up) to write a text post, or share a photo
 * or video with an optional caption. Tag people with @, or everyone with @all.
 * The text box and tools sit at the top, so the keyboard never covers them.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AtSign, ImagePlus, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { AudienceNote, clientOnly } from "@/components/SocialUI";
import { MAX_CHARS, TagPicker, withTag } from "@/components/SceneParts";
import { fileToImage, meView, social } from "@/lib/social";

const MAX_VIDEO_MB = 50;

export const Route = createFileRoute("/app/scenes/new")({
  component: clientOnly(NewScene),
});

function NewScene() {
  const navigate = useNavigate();
  const close = () => {
    if (window.history.length > 1) window.history.back();
    else void navigate({ to: "/app/feed" });
  };
  const me = meView();
  const fileRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [video, setVideo] = useState<{ file: File; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [text]);

  const put = (handle: string) => {
    setText((t) => withTag(t, handle));
    boxRef.current?.focus();
  };
  const addAt = () => {
    setText((t) => (t && !/\s$/.test(t) ? `${t} @` : `${t}@`));
    boxRef.current?.focus();
  };

  const left = MAX_CHARS - text.length;
  const canPost = (text.trim().length > 0 || !!image || !!video) && left >= 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--page)" }}>
      <div className="mx-auto w-full max-w-md flex flex-col h-full app-column">
        {/* Top bar: Cancel and Post, like X. */}
        <header
          className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <button
            onClick={close}
            className="font-semibold text-cream py-2"
            style={{ fontSize: 15.5 }}
          >
            Cancel
          </button>
          <h1 className="sr-only">New scene</h1>
          <button
            disabled={!canPost}
            onClick={() => {
              social.addPost(image ?? "", text, video?.file);
              try {
                sessionStorage.setItem("tf.scene.posted", "1");
              } catch {
                // ignore
              }
              close();
            }}
            className="rounded-full px-5 font-bold transition-opacity disabled:opacity-40"
            style={{
              minHeight: 38,
              fontSize: 15,
              background: "var(--lime)",
              color: "var(--on-accent)",
            }}
          >
            Post
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4" data-noswipe>
          <div className="flex gap-3 pt-4">
            <Avatar src={me.avatar} initials={me.initials} size={40} />
            <div className="flex-1 min-w-0">
              <label htmlFor="scene-text" className="sr-only">
                What's happening
              </label>
              <textarea
                id="scene-text"
                ref={boxRef}
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS + 20))}
                placeholder={image || video ? "Add a caption (optional)" : "What's happening?"}
                rows={2}
                className="w-full resize-none bg-transparent outline-none text-cream pt-2"
                style={{ fontSize: 18, lineHeight: 1.4 }}
              />
              <TagPicker text={text} onPick={put} />
              {(image || video) && (
                <div
                  className="relative mt-1 rounded-2xl overflow-hidden"
                  style={{ border: "1px solid var(--line)" }}
                >
                  {video ? (
                    <video
                      src={video.url}
                      muted
                      autoPlay
                      loop
                      playsInline
                      className="w-full max-h-[320px] object-cover"
                    />
                  ) : (
                    <img
                      src={image!}
                      alt="Your photo"
                      className="w-full max-h-[320px] object-cover"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setImage(null);
                      setVideo(null);
                    }}
                    aria-label="Remove photo or video"
                    className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
          {error && (
            <p className="mt-2 text-sm" style={{ color: "var(--coral-deep)" }} role="alert">
              {error}
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                if (f.type.startsWith("video/")) {
                  if (f.size > MAX_VIDEO_MB * 1024 * 1024)
                    throw new Error(
                      `Videos can be up to ${MAX_VIDEO_MB} MB. Trim it a bit and try again.`,
                    );
                  setImage(null);
                  setVideo({ file: f, url: URL.createObjectURL(f) });
                } else {
                  setVideo(null);
                  setImage(await fileToImage(f));
                }
                setError(null);
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          />
          {/* Toolbar */}
          <div
            className="flex items-center gap-1 mt-3 pt-3"
            style={{ borderTop: "1px solid var(--line)" }}
          >
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Add a photo or video"
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[var(--fill)]"
              style={{ color: "var(--lime)" }}
            >
              <ImagePlus size={21} />
            </button>
            <button
              type="button"
              onClick={addAt}
              aria-label="Tag someone"
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[var(--fill)]"
              style={{ color: "var(--lime)" }}
            >
              <AtSign size={21} />
            </button>
            <span
              className="ml-auto mr-2 tabular-nums meta"
              style={{
                fontSize: 12.5,
                color: left < 0 ? "var(--coral-deep)" : left <= 20 ? "var(--sun)" : undefined,
              }}
              aria-live="polite"
            >
              {left <= 40 ? left : ""}
            </span>
          </div>
          <div className="mt-3 pb-6">
            <AudienceNote>Only people at your Table will see this.</AudienceNote>
          </div>
        </div>
      </div>
    </div>
  );
}
