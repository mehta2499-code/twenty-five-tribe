/** Remember a link someone opened before signing in (e.g. a party), and go there after. */
const KEY = "tf.pendingPath";
export function savePendingPath(path: string) {
  try {
    if (path.startsWith("/app/play/")) localStorage.setItem(KEY, path);
  } catch {
    // ignore
  }
}
export function takePendingPath(): string | null {
  try {
    const p = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    return p;
  } catch {
    return null;
  }
}
export function peekPendingPath(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
