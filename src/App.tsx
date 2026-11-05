import { useEffect } from "react";
import { AuthScreen } from "./components/AuthScreen";
import { DayShell } from "./components/DayShell";
import { LockScreen } from "./components/LockScreen";
import { SessionProvider, useSession } from "./lib/session";

function Root() {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div className="ds-splash">
        <span className="ds-wordmark">DAYSTREAM</span>
      </div>
    );
  }
  if (status === "signedOut") return <AuthScreen />;
  if (status === "locked") return <LockScreen />;
  return <DayShell />;
}

export default function App() {
  // iOS Safari does not shrink the layout viewport when the keyboard opens;
  // the editor sizes itself from the visual viewport instead.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      document.documentElement.style.setProperty(
        "--viewport-height",
        `${Math.round(viewport.height)}px`,
      );
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      document.documentElement.style.removeProperty("--viewport-height");
    };
  }, []);

  return (
    <SessionProvider>
      <Root />
    </SessionProvider>
  );
}
