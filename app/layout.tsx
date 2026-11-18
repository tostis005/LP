import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Loyally — Haz que tus clientes vuelvan",
  description: "Una plataforma de fidelización simple y poderosa para negocios locales. Sellos, puntos, cashback y tarjetas digitales.",
};
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="es"><body>{children}</body></html>;
}
