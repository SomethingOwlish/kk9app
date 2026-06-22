import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import AuthGate from "./components/AuthGate";
import App from "./App";

// AuthGate отдаёт { user, signOut } внутрь App через render-проп.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate>
      {({ user, signOut }) => <App user={user} signOut={signOut} />}
    </AuthGate>
  </React.StrictMode>
);
