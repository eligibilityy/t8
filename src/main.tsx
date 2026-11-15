import React from "react";
import ReactDOM from "react-dom/client";

// Fonts are self-hosted so exports can embed them
import "@fontsource/bebas-neue/400.css";
import "./fonts.css";
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
