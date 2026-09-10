import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "./theme-provider";
import { SwRegister } from "./sw-register";
import "./globals.css";

// Hanken Grotesk now does two jobs, and only one of them is "the sans".
//
// It is still the typeface of the marketing site and the guest-facing screens
// (kiosk, customer display, online ordering, booking), which is what
// --font-sans means and where `html { @apply font-sans }` still applies it.
//
// It is ALSO the admin's numeric face. The signed-in surface is set in Times
// New Roman, which ships no tabular figure set — so every figure that sits in
// a column or updates live is set in this instead, via --font-numeric. That
// reuse is the point: the grotesque is already in the page for the marketing
// side, so carrying the admin's figures costs no extra request, and a neutral
// grotesque sits beside a serif without announcing itself the way a mono
// would. See the `.u-serif` block in globals.css for the full argument.
//
// The serif itself is deliberately NOT wired here: Times New Roman is a system
// font on macOS, iOS and Windows, and adding a network request to fetch a font
// the machine already has would be strictly worse. Its fallback stack lives in
// globals.css with the rest of the tokens.
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
  themeColor: "#0b0e14",
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