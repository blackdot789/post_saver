import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { readLocal } from "../../lib/storage.ts";
import { AppPage } from "./AppPage.tsx";

// Apply the last known theme before the first paint, so a dark-theme user sees no flash.
try {
  const uid = readLocal("ps:last-uid");
  const theme = uid ? (JSON.parse(readLocal(`ps:settings:${uid}`) ?? "{}") as { theme?: string }).theme : undefined;
  if (theme === "dark" || theme === "light") document.documentElement.dataset.theme = theme;
} catch {
  // No stored theme; the OS preference applies.
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <AppPage />
    </StrictMode>,
  );
}
