/**
 * Registers the service worker (apps/web/sw.template.js), which lets the app's pages open
 * without a connection. Production builds only: the dev server has no /sw.js.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const register = () => void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
