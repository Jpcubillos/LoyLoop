import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LoyLoop",
  description: "Recompensas, misiones y beneficios para comercios locales.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  }
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
