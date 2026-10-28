import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: { default: "BlitzMove", template: "%s · BlitzMove" },
  description: "BlitzMove transportation, logistics and fleet management.",
};

export const viewport: Viewport = { themeColor: "#e30613" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
