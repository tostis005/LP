import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  // Keep the browser URL at / and resolve the customer landing in its own compiled route.
  async rewrites(){return {beforeFiles:[{source:"/",destination:"/inicio"}],afterFiles:[],fallback:[]};}
};
export default nextConfig;