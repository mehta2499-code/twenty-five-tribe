import { Volume2, VolumeX } from "lucide-react";
import { setSound, useSound } from "@/lib/sfx";

/** Speaker button: game sounds and music on/off (remembered on this phone). */
export function SoundToggle({ className = "" }: { className?: string }) {
  const on = useSound();
  return (
    <button
      type="button"
      onClick={() => setSound(!on)}
      aria-label={on ? "Mute game sounds" : "Turn game sounds on"}
      aria-pressed={on}
      className={`w-10 h-10 rounded-full flex items-center justify-center text-cool ${className}`}
    >
      {on ? <Volume2 size={20} /> : <VolumeX size={20} />}
    </button>
  );
}
