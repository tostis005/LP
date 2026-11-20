import type { ProgramType } from "@/lib/types";
export function money(cents: number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format((cents || 0) / 100);
}
export function dateShort(s: string) { return new Date(s).toLocaleDateString("es-ES", {day:"2-digit",month:"short",year:"numeric"}); }
export function units(balance: number, type: ProgramType | undefined, currency = "MXN") {
  if (type === "cashback") return money(balance,currency);
  return balance + (type === "stamps" ? " sellos" : " puntos");
}
export function initials(s: string) { return s.split(/\s+/).slice(0,2).map(v=>v.slice(0,1)).join("").toUpperCase(); }
export function normalizeToken(s: string) {
  const candidate = s.trim();
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    const match = url.pathname.match(/\/t\/([a-f0-9-]{36})/i);
    return match?.[1] ?? "";
  } catch { return /^[a-f0-9-]{36}$/i.test(candidate) ? candidate : ""; }
}
