import assert from "node:assert/strict";
import pg from "pg";
const pool=new pg.Pool({
 host:process.env.PGHOST||"127.0.0.1",
 port:Number(process.env.PGPORT||5432),
 database:process.env.POSTGRES_DB,
 user:process.env.POSTGRES_USER,
 password:process.env.POSTGRES_PASSWORD
});
try{
 const result=await pool.query("SELECT column_name,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='businesses' AND column_name IN ('accent_color','stamp_color')");
 const defaults=Object.fromEntries(result.rows.map(r=>[r.column_name,r.column_default]));
 for(const key of ["accent_color","stamp_color"])
  assert.match(defaults[key]||"",/#571c32/,"New businesses should default to wine: "+key);
 const rows=await pool.query("SELECT COUNT(*)::int AS count FROM public.businesses WHERE accent_color NOT IN ('#571c32')");
 assert.ok(rows.rows[0].count>=1,"Other business colors should remain supported");
 console.log("OK: database brand defaults are wine and merchant-specific colors remain available.");
}finally{await pool.end();}
