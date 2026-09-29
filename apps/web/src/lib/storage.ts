// localStorage for small conveniences. It can be missing or throw (private mode, blocked site
// data, some in-app browsers), so every access is guarded and nothing important depends on it.

export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not stored; the feature just forgets across reloads.
  }
}
