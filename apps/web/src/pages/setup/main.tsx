import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { watchInstall } from "../../lib/install.ts";
import { registerServiceWorker } from "../../lib/serviceWorker.ts";
import { SetupPage } from "./SetupPage.tsx";

watchInstall();
registerServiceWorker();

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <SetupPage />
    </StrictMode>,
  );
}
