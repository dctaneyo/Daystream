export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">You're offline</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Daystream kept working — your notes are stored on this device and will sync the moment the
        connection returns. Reopen the app from your home screen to keep writing.
      </p>
      <a href="/app" className="ds-button ds-button-primary mt-6 self-center px-5 py-2.5">
        Open Daystream
      </a>
    </main>
  );
}
