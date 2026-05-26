/**
 * Privacy gate page stub (FE-1 §B.5). Slice D replaces this with the
 * real acknowledgement form; the stub exists so Slice A's (authed)
 * guard, which redirects un-ack'd users here, lands on a real page
 * instead of Next.js's 404.
 */

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-2 text-sm text-gray-600">
        The privacy acknowledgement form lands in FE-1 Slice D.
      </p>
    </main>
  );
}
