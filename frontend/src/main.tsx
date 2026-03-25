import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProviders } from "@/providers/AppProviders";
import App from "@/App";
import { captureReferralFromLocation } from "@/lib/referralStorage";
import "@/index.css";

// SPDX-License-Identifier: AGPL-3.0-only

captureReferralFromLocation();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
