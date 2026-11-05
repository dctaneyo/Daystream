import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// The console is a separate surface: its own URL and its own lazy chunk, so it
// never adds chrome or weight to the day view.
const AdminApp = lazy(() => import("./admin/AdminApp"));
const adminPath = window.location.pathname.replace(/\/+$/, "") === "/admin";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline shell is optional */
    });
  });
}

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root");

createRoot(container).render(
  <StrictMode>
    {adminPath ? (
      <Suspense
        fallback={
          <div className="ds-splash">
            <span className="ds-wordmark">DAYSTREAM</span>
          </div>
        }
      >
        <AdminApp />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
