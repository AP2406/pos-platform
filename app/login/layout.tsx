import type { Metadata } from "next";

// /login is a Client Component and can't export metadata itself, so the noindex
// lives here (section 3). robots.txt also disallows /login.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
