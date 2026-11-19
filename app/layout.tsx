import type { Metadata } from "next";
import "./globals.css";
import "./workspace.css";
import "./brand-wine.css";
import {PwaSetup} from "@/components/PwaSetup";
import {InstallLoyally} from "@/components/InstallLoyally";
export const metadata: Metadata = {
  title: "Loyally — Haz que tus clientes vuelvan",
  description: "Una plataforma de fidelización simple y poderosa para negocios locales. Sellos, puntos, cashback y tarjetas digitales.",
  manifest:"/manifest.webmanifest",
  appleWebApp:{capable:true,statusBarStyle:"default",title:"Loyally"},
  icons:{icon:[{url:"/icon.svg",type:"image/svg+xml"}],apple:"/apple-touch-icon.png"},
};
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="es"><body><PwaSetup/>{children}<InstallLoyally/></body></html>;
}
