"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
let instance: SupabaseClient | null = null;
export function configured() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
export function db(): SupabaseClient {
  if (!configured()) throw new Error("Supabase no está configurado. Consulta docs/SETUP.md.");
  if (!instance) instance = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return instance;
}
