import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Providers } from "@/components/providers";
import "@/styles/globals.css";

const DESCRIPTION = "BlitzMove transportation, logistics and fleet management.";

/**
 * Link previews need absolute image URLs, so the base comes from the request
 * (nginx forwards Host and X-Forwarded-Proto). Works for the bare IP today and
 * a domain later without a rebuild. The preview images themselves are the
 * opengraph-image/twitter-image files next to this layout.
 */
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? "http";

  return {
    metadataBase: new URL(`${proto}://${host}`),
    title: { default: "BlitzMove", template: "%s · BlitzMove" },
    description: DESCRIPTION,
    applicationName: "BlitzMove",
    openGraph: {
      type: "website",
      siteName: "BlitzMove",
      title: "BlitzMove",
      description: DESCRIPTION,
      url: "/",
    },
    twitter: { card: "summary_large_image", title: "BlitzMove", description: DESCRIPTION },
  };
}

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
