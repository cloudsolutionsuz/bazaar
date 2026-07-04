import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n/i18n";
import "./index.css";
import { App } from "./App";
import { ThemeProvider } from "./context/ThemeContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
