import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { disablePush, enablePush, pushStatus, type PushStatus } from "@/lib/push";

const DISMISS = "tf.push.dismissed";

/** Card on the Table asking to turn on notifications. */
export function PushPrompt() {
  const [st, setSt] = useState<PushStatus>("unsupported");
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setSt(pushStatus());
    try {
      setHidden(localStorage.getItem(DISMISS) === "1");
    } catch {
      setHidden(false);
    }
  }, []);
  if (hidden || st === "on" || st === "unsupported" || st === "denied") return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS, "1");
    } catch {
      // ignore
    }
  };
  return (
    <section className="px-5 mt-5">
      <div className="card p-4 flex gap-3 items-start">
        <Bell size={28} strokeWidth={2.25} aria-hidden="true" className="shrink-0" style={{ color: "var(--sun)" }} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-cream">Don't miss your 25</p>
          {st === "needs-install" ? (
            <p className="meta mt-1">
              iPhone only sends notifications to apps on your Home Screen. Tap <b>Share</b> →{" "}
              <b>Add to Home Screen</b>, open 25 from there, then turn them on.
            </p>
          ) : (
            <p className="meta mt-1">
              Snaps, messages, polls, the Drop. Get a buzz when it happens.
            </p>
          )}
          {err && (
            <p className="text-sm mt-1" style={{ color: "var(--pink)" }}>
              {err}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            {st === "off" && (
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setErr(null);
                  try {
                    setSt(await enablePush());
                  } catch (e) {
                    setErr((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
                className="btn-primary px-4 min-h-[40px] text-sm"
              >
                {busy ? "…" : "Turn on notifications"}
              </button>
            )}
            <button onClick={dismiss} className="btn-quiet px-3 min-h-[40px] text-sm">
              Not now
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Profile row: notifications on/off for this device. */
export function PushSetting() {
  const [st, setSt] = useState<PushStatus>("unsupported");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setSt(pushStatus()), []);
  const label: Record<PushStatus, string> = {
    on: "On for this device",
    off: "Off",
    denied: "Blocked in your browser settings",
    "needs-install": "Add 25 to your Home Screen first",
    unsupported: "Not supported in this browser",
  };
  return (
    <div className="card p-4 flex items-center gap-3">
      {st === "on" ? (
        <Bell size={20} className="text-bronze" />
      ) : (
        <BellOff size={20} className="text-faint" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-cream">Notifications</p>
        <p className="meta">{err ?? label[st]}</p>
      </div>
      {(st === "on" || st === "off") && (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              if (st === "on") {
                await disablePush();
                setSt("off");
              } else setSt(await enablePush());
            } catch (e) {
              setErr((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
          className={`${st === "on" ? "btn-secondary" : "btn-primary"} px-4 min-h-[38px] text-sm`}
        >
          {busy ? "…" : st === "on" ? "Turn off" : "Turn on"}
        </button>
      )}
    </div>
  );
}
