import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LoyLoop",
  description: "Recompensas, misiones y beneficios para comercios locales."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
