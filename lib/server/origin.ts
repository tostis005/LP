import {isIP} from "node:net";

// Compare the browser Origin with the configured public URL. An IP-based
// installation may be reachable through both the HTTP and HTTPS Caddy sites,
// while NEXT_PUBLIC_SITE_URL names only one of those schemes.
export function isAllowedOrigin(origin:string|null,publicSiteUrl:string|undefined):boolean {
 if(!origin)return true; // Non-browser clients need an independent session.
 if(!publicSiteUrl)return false;
 try {
  const requested=new URL(origin),site=new URL(publicSiteUrl);
  if(requested.origin===site.origin && origin===requested.origin)return true;

  // Only the exact configured public IP, with standard HTTP(S) ports.
  // Do not accept arbitrary hosts, forwarded-host values or alternate ports.
  return isIP(site.hostname)>0 &&
   requested.hostname===site.hostname &&
   !site.port && !requested.port &&
   (site.protocol==="http:"||site.protocol==="https:") &&
   (requested.protocol==="http:"||requested.protocol==="https:") &&
   origin===requested.origin;
 }catch{return false}
}
