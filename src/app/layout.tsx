import type { Metadata, Viewport } from "next";
import { Sora, DM_Sans } from "next/font/google";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { ThemeSync } from "@/components/theme";
import "./globals.css";

const display = Sora({ variable: "--font-display", subsets: ["latin"], display: "swap" });
const body = DM_Sans({ variable: "--font-body", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "CAS ERP", template: "%s · CAS ERP" },
  description: "Invoicing, debtors, creditors and stock for Caveman Architectural Studios.",
  applicationName: "CAS ERP",
  appleWebApp: { capable: true, title: "CAS", statusBarStyle: "black-translucent" },
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f1ec" },
    { media: "(prefers-color-scheme: dark)", color: "#11110f" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = (await cookies()).get("cas-theme")?.value;
  const themeClass = theme === "dark" ? "dark" : theme === "light" ? "light" : "";
  return (
    <html lang="en-ZA" className={`${display.variable} ${body.variable} ${themeClass} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full">
        <ThemeSync preference={theme === "dark" || theme === "light" ? theme : "system"} />
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{ classNames: { toast: "!rounded-2xl !font-sans" } }}
        />
      </body>
    </html>
  );
}
