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