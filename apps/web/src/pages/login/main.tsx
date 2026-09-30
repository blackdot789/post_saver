import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LoginPage } from "./LoginPage.tsx";
import { registerServiceWorker } from "../../lib/serviceWorker.ts";

registerServiceWorker();

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <LoginPage />
    </StrictMode>,
  );
}
