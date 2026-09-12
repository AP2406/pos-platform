import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "./theme-provider";
import { SwRegister } from "./sw-register";
import "./globals.css";

const sans = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Surge — Run your business",
  description: "The operations platform for service businesses.",
  applicationName: "Surge",
  appleWebApp: {
    capable: true,
    title: "Surge",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // Surge-Logo-Kit-v1's ink, #101318 — the same value the app tile's square is
  // filled with, so the installed app's status bar and its icon are one colour.
  themeColor: "#101318",
  // The POS runs as an installed app on tablets and phones: draw edge-to-edge
  // behind notches/home bars (safe-area padding is applied where needed) and
  // disable pinch/double-tap zoom so fast register taps never zoom the UI.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={sans.variable + " " + geistMono.variable + " h-full antialiased"}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>{children}</ThemeProvider>
        <SwRegister />
      </body>
    </html>
  );
}