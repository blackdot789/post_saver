/**
 * Whether the page is shown inside another site's frame. A static host can't send the header
 * that forbids that, so the app checks for itself and refuses to show the library (with its
 * Settings and "Delete account") where a hidden frame could trick someone into clicking
 * (CLAUDE.md §6.9).
 */
export function isFramed(): boolean {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
}
