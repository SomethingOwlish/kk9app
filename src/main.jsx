import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import AuthGate from "./components/AuthGate";
import App from "./App";
import CampaignSelect from "./components/CampaignSelect";
import { hasChosenCampaign } from "./lib/config";
import LandingPage from "./views/LandingPage";
import PrintView from "./views/PrintView";
import ThemeExplorer from "./views/ThemeExplorer";

// Top-level routes:
//   #/landing       → LandingPage placeholder (B-20 will fill this)
//   #/print/:charId → PrintView placeholder (B-23 will fill this)
//   #/*             → Main app shell (auth-gated)
//
// Sub-views within the main app (card, advance, log, settings) are URL-driven
// via useNavigate/useLocation inside App.jsx and will be formally decomposed in B-06.

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route
          path="/landing"
          element={
            <AuthGate>
              {({ user, signOut }) => <LandingPage user={user} signOut={signOut} />}
            </AuthGate>
          }
        />
        <Route path="/print/:charId" element={<PrintView />} />
        <Route path="/theme" element={<ThemeExplorer />} />
        <Route
          path="/select"
          element={
            <AuthGate>
              {({ user, signOut }) => <CampaignSelect user={user} signOut={signOut} />}
            </AuthGate>
          }
        />
        <Route
          path="/*"
          element={
            <AuthGate>
              {({ user, signOut }) =>
                hasChosenCampaign()
                  ? <App user={user} signOut={signOut} />
                  : <Navigate to="/select" replace />}
            </AuthGate>
          }
        />
      </Routes>
    </HashRouter>
  </React.StrictMode>
);
