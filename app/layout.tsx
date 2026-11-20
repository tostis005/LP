import type { Metadata } from "next";
import "./globals.css";
import "./workspace.css";
import "leaflet/dist/leaflet.css";
import "./brand-wine.css";
import "./brand-tokens.css";
import "./brand-kreyv.css";
import {BRAND_NAME, BRAND_THEME} from "@/lib/brand";
import {PwaSetup} from "@/components/PwaSetup";
import {AppBottomNav} from "@/components/AppBottomNav";
import {ActionToast} from "@/components/ActionToast";
export const metadata: Metadata = {
  title: BRAND_NAME + " — Haz que tus clientes vuelvan",
  description: "Una plataforma de fidelización simple y poderosa para negocios locales. Sellos, puntos, cashback y tarjetas digitales.",
  manifest:"/manifest.webmanifest",
  appleWebApp:{capable:true,statusBarStyle:"default",title:BRAND_NAME},
  icons:{icon:[{url:"/icon.svg",type:"image/svg+xml"}],apple:"/apple-touch-icon.png"},
};
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="es" data-theme={BRAND_THEME}><body><PwaSetup/>{children}<AppBottomNav/><ActionToast/></body></html>;
}
