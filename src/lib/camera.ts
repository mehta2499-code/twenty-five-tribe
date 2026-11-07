/**
 * The Blink camera stream, kept open briefly between uses so the viewfinder
 * comes back instantly (and the phone doesn't ask for permission again).
 */
type Facing = "user" | "environment";
let cache: { stream: MediaStream; facing: Facing; stopTimer?: ReturnType<typeof setTimeout> } | null =
  null;
let warming: Promise<MediaStream> | null = null;

export const CAMERA_CONSTRAINTS = (facing: Facing): MediaStreamConstraints => ({
  video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1920 } },
  audio: false,
});

/*
 * Keep the stream (paused) for a minute after leaving Blink, so coming back is
 * instant; let it go when the app is left. (iPhone uses the camera app instead.)
 */
const PERSIST = 60_000;
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && cache) {
      cache.stream.getTracks().forEach((t) => t.stop());
      if (cache.stopTimer) clearTimeout(cache.stopTimer);
      cache = null;
    }
  });
}

/** Remember "no thanks" to the live camera: use the phone's camera app instead. */
const DENIED = "tf.cam.denied";
export const cameraDenied = () => {
  try {
    return localStorage.getItem(DENIED) === "1";
  } catch {
    return false;
  }
};
export const setCameraDenied = (v: boolean) => {
  try {
    if (v) localStorage.setItem(DENIED, "1");
    else localStorage.removeItem(DENIED);
  } catch {
    // ignore
  }
};

export function takeCachedStream(facing: Facing) {
  if (!cache) return null;
  if (cache.stopTimer) clearTimeout(cache.stopTimer);
  const live = cache.stream.getVideoTracks().some((t) => t.readyState === "live");
  if (live && cache.facing === facing) {
    const s = cache.stream;
    s.getVideoTracks().forEach((t) => (t.enabled = true));
    cache = null;
    return s;
  }
  cache.stream.getTracks().forEach((t) => t.stop());
  cache = null;
  return null;
}

export function parkStream(stream: MediaStream, facing: Facing, ms = PERSIST) {
  if (cache && cache.stream !== stream) cache.stream.getTracks().forEach((t) => t.stop());
  // Paused while parked: no frames are processed.
  stream.getVideoTracks().forEach((t) => (t.enabled = false));
  cache = {
    stream,
    facing,
    stopTimer: setTimeout(() => {
      stream.getTracks().forEach((t) => t.stop());
      cache = null;
    }, ms),
  };
}

/** Get the camera, reusing a parked or warming stream when there is one. */
export function openCamera(facing: Facing): Promise<MediaStream> {
  const cached = takeCachedStream(facing);
  if (cached) return Promise.resolve(cached);
  if (warming && facing === "user") {
    const w = warming;
    warming = null;
    return w;
  }
  return navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS(facing));
}

/** Start the front camera the moment a finger touches the Blink tab. */
export const isIOS = () =>
  typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

export function warmCamera() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
  // iPhone uses the camera app for blinks: never trigger a permission prompt.
  if (isIOS()) return;
  if (cache || warming || cameraDenied()) return;
  warming = navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS("user"));
  warming.catch(() => {
    warming = null;
  });
  // Nobody picked it up (they didn't open Blink after all): close it.
  const w = warming;
  setTimeout(() => {
    if (warming === w) {
      warming = null;
      void w.then((s) => parkStream(s, "user")).catch(() => undefined);
    }
  }, 4000);
}

/** Encode a canvas off the main thread, as a blob: URL (fast, no huge strings). */
export function canvasToUrl(c: HTMLCanvasElement, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(URL.createObjectURL(b)) : reject(new Error("Couldn't save the photo."))),
      "image/jpeg",
      quality,
    ),
  );
}

/** Shrink a picked photo to `max` px without blocking the screen. */
export async function fileToPhoto(file: File, max = 1920): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {
      throw new Error("That file isn't an image we can read.");
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await canvasToUrl(c, 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}
