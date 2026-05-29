import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";

import App from "./app/App";
import "./styles/index.css";
import { I18nProvider } from "./shared/i18n";

import { Toaster } from "@/shared/ui";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element '#root' was not found in index.html.");
}

createRoot(rootElement).render(
  <StrictMode>
    <I18nProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableColorScheme
        enableSystem
        storageKey="app_theme_mode"
      >
        <App />
        <Toaster position="top-right" richColors />
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>,
);
