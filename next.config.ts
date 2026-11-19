import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  // La portada permanece en / aunque la sirvamos desde una ruta interna
  // independiente del enrutador de sesiones /entrar.
  async rewrites() {
    return [{source:"/",destination:"/presentacion"}];
  }
};
export default nextConfig;