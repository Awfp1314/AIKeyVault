import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import "./styles/globals.css";
import "./i18n/config";

// Dynamically set body background based on window type
const currentWindow = getCurrentWindow();
const isDashboard = currentWindow.label === "dashboard";

if (isDashboard) {
  // Dashboard window: solid dark gradient to prevent white flash
  document.body.style.background = "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)";
  document.body.style.margin = "0";
  document.body.style.overflow = "hidden";
}
// Main window keeps transparent background from globals.css

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
