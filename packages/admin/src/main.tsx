import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n/i18n";
import "./index.css";
import { App } from "./App";
import { ThemeProvider } from "./context/ThemeContext";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
