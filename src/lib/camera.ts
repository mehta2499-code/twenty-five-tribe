/**
 * The Blink camera stream, kept open briefly between uses so the viewfinder
 * comes back instantly (and the phone doesn't ask for permission again).
 */
type Facing = "user" | "environment";
let cache: { stream: MediaStream; facing: Facing; stopTimer?: ReturnType<typeof setTimeout> } | null =
  null;
let warming: Promise<MediaStream> | null = null;

export const CAMERA_CONSTRAINTS = (facing: Facing): MediaStreamConstraints => ({
  // 1280 is plenty for a phone screen and starts much faster than full resolution.
  video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } },
  audio: false,
});

export function takeCachedStream(facing: Facing) {
  if (!cache) return null;
  if (cache.stopTimer) clearTimeout(cache.stopTimer);
  const live = cache.stream.getVideoTracks().some((t) => t.readyState === "live");
  if (live && cache.facing === facing) {
    const s = cache.stream;
    cache = null;
    return s;
  }
  cache.stream.getTracks().forEach((t) => t.stop());
  cache = null;
  return null;
}

export function parkStream(stream: MediaStream, facing: Facing, ms = 60_000) {
  if (cache && cache.stream !== stream) cache.stream.getTracks().forEach((t) => t.stop());
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
export function warmCamera() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
  if (cache || warming) return;
  warming = navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS("user"));
  warming.catch(() => {
    warming = null;
  });
  // Nobody picked it up (they didn't open Blink after all): close it.
  const w = warming;
  setTimeout(() => {
    if (warming === w) {
      warming = null;
      void w.then((s) => parkStream(s, "user", 15_000)).catch(() => undefined);
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
export async function fileToPhoto(file: File, max = 1440): Promise<string> {
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
    return await canvasToUrl(c, 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}
