// Crear el primer administrador de LP sin registrar contraseñas en Git.
import pg from "pg";
import {randomBytes,scrypt as callback} from "node:crypto";
import {promisify} from "node:util";
const scrypt=promisify(callback);
const email=(process.env.LP_ADMIN_EMAIL||"").trim().toLowerCase();
const password=process.env.LP_ADMIN_PASSWORD||"";
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<12||password.length>128)
 throw new Error("Establece LP_ADMIN_EMAIL y LP_ADMIN_PASSWORD (mínimo 12 caracteres).");
const pool=new pg.Pool({host:process.env.PGHOST||"db",database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD});
const db=await pool.connect();
try {
 await db.query("BEGIN");
 let result=await db.query("SELECT id FROM auth.users WHERE lower(email)=$1",[email]);
 let id;
 if(result.rowCount){id=result.rows[0].id;console.log("Cuenta existente; no se modifica su contraseña.");}
 else{
  const salt=randomBytes(16).toString("hex");
  const hash="scrypt$"+salt+"$"+(await scrypt(password,salt,64)).toString("hex");
  result=await db.query(
   "INSERT INTO auth.users(email,password_hash,raw_user_meta_data,email_confirmed_at) VALUES($1,$2,$3::jsonb,now()) RETURNING id",
   [email,hash,JSON.stringify({full_name:"Administrador LP"})]
  );
  id=result.rows[0].id;
 }
 await db.query("INSERT INTO public.platform_admins(user_id) VALUES($1) ON CONFLICT DO NOTHING",[id]);
 await db.query("COMMIT");
 console.log("Administrador habilitado:",email);
}catch(e){await db.query("ROLLBACK");throw e}
finally{db.release();await pool.end()}
