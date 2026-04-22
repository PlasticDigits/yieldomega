import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProviders } from "@/providers/AppProviders";
import App from "@/App";
import { applyReferralUrlCapture } from "@/lib/referralStorage";
import "@/index.css";

// SPDX-License-Identifier: AGPL-3.0-only

applyReferralUrlCapture(window.location.pathname, window.location.search);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
