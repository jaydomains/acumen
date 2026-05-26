import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth/context";
import { MSWProvider } from "@/mocks/MSWProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Acumen",
  description: "Adaptive learning and competency assessment",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MSWProvider>
          <AuthProvider>{children}</AuthProvider>
        </MSWProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
