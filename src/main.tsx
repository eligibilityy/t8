import React from "react";
import ReactDOM from "react-dom/client";

// Self-hosted so the export can embed them
import "@fontsource/bebas-neue/400.css";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "flag-icons/css/flag-icons.min.css";

import "./App.css";
import "./layouts/layouts.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
