import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "My Pet Health",
    template: "%s | My Pet Health"
  },
  description: "Friendly, practical guidance to help you make thoughtful choices for your pet."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
