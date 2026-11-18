import type { Metadata } from "next";
import "./globals.css";

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL ?? "localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(configuredSiteUrl.startsWith("http") ? configuredSiteUrl : `https://${configuredSiteUrl}`),
  title: "Closets Monterrey",
  description: "Marketplace de moda de segunda mano en Monterrey.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
