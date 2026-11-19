import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const required = ["POSTGRES_DB","POSTGRES_USER","POSTGRES_PASSWORD","APP_DB_PASSWORD","AUTH_DB_PASSWORD"];
for (const n of required) if (!process.env[n]) throw new Error("Falta la variable " + n);
for (const n of ["APP_DB_PASSWORD","AUTH_DB_PASSWORD"]) {
  if (!/^[a-f0-9]{64}$/.test(process.env[n])) throw new Error(n + " debe ser hexadecimal de 64 caracteres.");
}
const pool = new pg.Pool({
  host: process.env.PGHOST || "db", port: 5432,
  user: process.env.POSTGRES_USER, database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD, max: 1
});
const client = await pool.connect();
const root = process.cwd();
try {
  // Papel de login sin privilegios, capaz de asumir anon/authenticated para aplicar RLS.
  for (const role of ["anon", "authenticated", "service_role", "lp_api", "lp_auth"]) {
    const exists = await client.query("SELECT 1 FROM pg_roles WHERE rolname=$1",[role]);
    if (!exists.rowCount) await client.query("CREATE ROLE " + role + (role.startsWith("lp_") ? " LOGIN NOINHERIT" : " NOLOGIN"));
  }
  await client.query("ALTER ROLE lp_api WITH LOGIN NOINHERIT PASSWORD '" + process.env.APP_DB_PASSWORD + "'");
  await client.query("ALTER ROLE lp_auth WITH LOGIN NOINHERIT PASSWORD '" + process.env.AUTH_DB_PASSWORD + "'");
  await client.query("GRANT anon, authenticated TO lp_api");
  await client.query("GRANT CONNECT ON DATABASE " + '"' + process.env.POSTGRES_DB.replaceAll('"','""') + '"' + " TO lp_api, lp_auth");
  await client.query("CREATE TABLE IF NOT EXISTS public.local_schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");

  const files = [
    resolve(root,"db/migrations/000_bootstrap.sql"),
    ...readdirSync(resolve(root,"supabase/migrations")).filter(n => /^\d+_.+\.sql$/.test(n)).sort().map(n=>resolve(root,"supabase/migrations",n)),
    ...readdirSync(resolve(root,"db/migrations")).filter(n => /^\d+_.+\.sql$/.test(n) && n!=="000_bootstrap.sql").sort().map(n=>resolve(root,"db/migrations",n))
  ];
  for (const path of files) {
    const name = path.split("/").at(-1);
    const check = await client.query("SELECT 1 FROM public.local_schema_migrations WHERE name=$1",[name]);
    if (check.rowCount) { console.log("Ya aplicada:",name); continue; }
    console.log("Aplicando:",name);
    await client.query("BEGIN");
    try {
      await client.query(readFileSync(path,"utf8"));
      await client.query("INSERT INTO public.local_schema_migrations(name) VALUES($1)",[name]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw new Error("Migración " + name + ": " + e.message, {cause:e});
    }
  }
  await client.query("GRANT USAGE ON SCHEMA public TO authenticated,anon,lp_auth");
  await client.query("GRANT USAGE ON SCHEMA auth TO lp_auth,authenticated,anon,authenticated,anon");
  await client.query("GRANT USAGE ON SCHEMA storage TO authenticated");
  await client.query("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO lp_auth");
  await client.query("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA storage TO authenticated");
  const tables=[
    "profiles","platform_admins","businesses","business_members","business_invitations",
    "loyalty_programs","loyalty_memberships","loyalty_transactions","business_locations",
    "marketing_consents","marketing_campaigns","platform_billing_settings",
    "business_billing","billing_webhook_events","business_leads","business_marketing_rates","reward_vouchers","marketing_deliveries","marketing_usage_ledger","reward_options","reward_redemptions"
  ];
  for (const table of tables) await client.query("GRANT SELECT,INSERT,UPDATE,DELETE ON public." + table + " TO authenticated");
  // El servicio de correo/auth puede registrar solicitudes y webhooks ya verificados.
  await client.query("GRANT EXECUTE ON FUNCTION public.submit_business_lead(text,text,text,text,text,text,boolean) TO lp_auth");
  await client.query("GRANT EXECUTE ON FUNCTION public.record_billing_event(text,uuid,text,text,text,bigint) TO lp_auth");
  console.log("Migraciones y permisos completados.");
} finally { client.release(); await pool.end(); }