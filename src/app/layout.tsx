import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";
import { BuildWatcher } from "@/components/BuildWatcher";
import { buildId } from "@/lib/build-id";
import { KeyboardInset } from "@/components/KeyboardInset";
import { ThemeScript } from "@/components/theme/ThemeScript";

const baseMetadata: Metadata = {
  title: {
    default: "Daystream — your day, as a stream",
    template: "%s · Daystream",
  },
  description:
    "A local-first daily notebook: quick Things, a calendar of your days, and realtime sync across every device.",
  applicationName: "Daystream",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Daystream",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false, date: false, address: false, email: false },
};

/**
 * The running bundle names itself in the document, which is how a stale tab can
 * compare itself with what the server now serves (UX-34).
 */
export function generateMetadata(): Metadata {
  return { ...baseMetadata, other: { "daystream-build": buildId() } };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#08090b" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  // Android resizes the layout viewport for the keyboard; iOS is handled by
  // KeyboardInset via visualViewport.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeScript />
        {children}
        <BuildWatcher />
        <KeyboardInset />
        <PwaRegister />
      </body>
    </html>
  );
}
