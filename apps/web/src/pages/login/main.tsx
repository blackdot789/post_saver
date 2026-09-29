import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LoginPage } from "./LoginPage.tsx";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <LoginPage />
    </StrictMode>,
  );
}
