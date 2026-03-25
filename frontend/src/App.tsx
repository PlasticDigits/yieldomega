import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RootLayout } from "@/layout/RootLayout";
import { CollectionPage } from "@/pages/CollectionPage";
import { HomePage } from "@/pages/HomePage";
import { RabbitTreasuryPage } from "@/pages/RabbitTreasuryPage";
import { ReferralsPage } from "@/pages/ReferralsPage";
import { TimeCurvePage } from "@/pages/TimeCurvePage";

// SPDX-License-Identifier: AGPL-3.0-only

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route index element={<HomePage />} />
          <Route path="timecurve" element={<TimeCurvePage />} />
          <Route path="rabbit-treasury" element={<RabbitTreasuryPage />} />
          <Route path="collection" element={<CollectionPage />} />
          <Route path="referrals" element={<ReferralsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
