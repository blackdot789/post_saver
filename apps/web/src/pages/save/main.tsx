import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SavePage } from "./SavePage.tsx";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <SavePage source="web" />
    </StrictMode>,
  );
}
