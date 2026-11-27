import type { Metadata } from "next";
import "./globals.css";
import "./workspace.css";
import "leaflet/dist/leaflet.css";
import "./brand-wine.css";
import "./brand-tokens.css";
import "./brand-kreyv.css";
import "./offers.css";
import "./product-polish.css";
import "./customer-app.css";
import "./role-app.css";
import "./public-pages.css";
import "./customer-entry.css";
import {BRAND_NAME, BRAND_THEME} from "@/lib/brand";
import {PwaSetup} from "@/components/PwaSetup";
import {AppBottomNav} from "@/components/AppBottomNav";
import {ActionToast} from "@/components/ActionToast";
export const metadata: Metadata = {
  metadataBase:new URL("https://kreyviapp.com"),
  title: BRAND_NAME + " — Tus lugares favoritos, tus próximos premios",
  description: "Todas tus tarjetas de fidelización, sellos y recompensas en un solo lugar.",
  manifest:"/manifest.webmanifest?v=kreyvi-v3",
  appleWebApp:{capable:true,statusBarStyle:"default",title:BRAND_NAME},
  icons:{
   icon:[{url:"/kreyv-favicon-v3.svg",type:"image/svg+xml"},{url:"/kreyv-favicon-v3-48.png",sizes:"48x48",type:"image/png"}],
   shortcut:"/kreyv-favicon-v3.svg",
   apple:"/kreyv-apple-touch-v3.png"
  },
};
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="es" data-theme={BRAND_THEME}><body><PwaSetup/>{children}<AppBottomNav/><ActionToast/></body></html>;
}
