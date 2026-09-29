import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppPage } from "./AppPage.tsx";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <AppPage />
    </StrictMode>,
  );
}
