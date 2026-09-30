// The Android share target (manifest share_target → /share/?title=&text=&url=). Same page as /save/.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SavePage } from "../save/SavePage.tsx";
import { registerServiceWorker } from "../../lib/serviceWorker.ts";

registerServiceWorker();

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <SavePage source="share-android" />
    </StrictMode>,
  );
}
