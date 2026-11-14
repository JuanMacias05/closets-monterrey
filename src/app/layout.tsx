import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
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
