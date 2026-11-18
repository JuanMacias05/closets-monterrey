import type { Metadata } from "next";
import { Archivo_Black, Archivo_Narrow } from "next/font/google";
import "./globals.css";

const archivoNarrow = Archivo_Narrow({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-archivo-narrow" });
const archivoBlack = Archivo_Black({ subsets: ["latin"], weight: "400", variable: "--font-archivo-black" });

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL ?? "localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(configuredSiteUrl.startsWith("http") ? configuredSiteUrl : `https://${configuredSiteUrl}`),
  title: "Closets Monterrey",
  description: "Marketplace de moda de segunda mano en Monterrey.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={`${archivoNarrow.variable} ${archivoBlack.variable}`}>
      <body>{children}</body>
    </html>
  );
}
