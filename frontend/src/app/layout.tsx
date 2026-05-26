import type { Metadata } from "next";
import { DM_Sans, Quicksand, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth/context";
import { ConfigProvider } from "@/lib/config/ConfigProvider";
import { MSWProvider } from "@/mocks/MSWProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme/bootstrap";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--acumen-font-sans",
  display: "swap",
});
const quicksand = Quicksand({
  subsets: ["latin"],
  variable: "--acumen-font-serif",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--acumen-font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Acumen",
  description: "Adaptive learning and competency assessment",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Server-set the paper default so first paint is correct even before
  // hydration. The inline <head> script overrides to "carbon" when the
  // returning user has it stored in localStorage — runs synchronously
  // before any CSS or React, so no FOUC.
  return (
    <html
      lang="en"
      data-theme="paper"
      className={`${dmSans.variable} ${quicksand.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <MSWProvider>
          <ConfigProvider>
            <QueryProvider>
              <AuthProvider>{children}</AuthProvider>
            </QueryProvider>
          </ConfigProvider>
        </MSWProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
