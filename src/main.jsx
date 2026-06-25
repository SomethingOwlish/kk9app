import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import AuthGate from "./components/AuthGate";
import App from "./App";
import LandingPage from "./views/LandingPage";
import PrintView from "./views/PrintView";

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
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/print/:charId" element={<PrintView />} />
        <Route
          path="/*"
          element={
            <AuthGate>
              {({ user, signOut }) => <App user={user} signOut={signOut} />}
            </AuthGate>
          }
        />
      </Routes>
    </HashRouter>
  </React.StrictMode>
);
