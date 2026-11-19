import pg from "pg";
const pool=new pg.Pool({host:process.env.PGHOST||"127.0.0.1",port:Number(process.env.PGPORT||5432),database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD});
const check=(v,why)=>{if(!v)throw Error("Prueba Tijuana: "+why)};
const a=await pool.connect();
try{
 const b=await a.query("SELECT count(*)::int n FROM public.businesses WHERE public_listing AND category IS NOT NULL");
 check(b.rows[0].n===10,"se esperaban 10 negocios visibles");
 const u=await a.query("SELECT count(*)::int n FROM auth.users WHERE email LIKE '%@demo.loyally.test'");
 check(u.rows[0].n===4,"se esperaban cuatro usuarios de prueba");
 const count=await a.query("SELECT count(*)::int n FROM public.business_locations WHERE city='Tijuana'");
 check(count.rows[0].n===10,"todas las ubicaciones deben estar georreferenciadas");
 const voucher=await a.query("SELECT v.token,v.status,m.id AS membership_id,b.id AS business_id FROM public.reward_vouchers v JOIN public.loyalty_memberships m ON m.id=v.membership_id JOIN public.businesses b ON b.id=v.business_id WHERE b.slug='cafe-noma'");
 check(voucher.rowCount===1&&voucher.rows[0].status==="issued","debe emitirse el QR automáticamente");
 const staff=await a.query("SELECT id FROM auth.users WHERE email='empleado@demo.loyally.test'");
 check(!!staff.rowCount,"falta empleado");
 await a.query("BEGIN");await a.query("SET LOCAL ROLE authenticated");
 await a.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[staff.rows[0].id]);
 const visible=await a.query("SELECT * FROM public.staff_lookup_voucher($1)",[voucher.rows[0].token]);
 check(visible.rowCount===1,"el empleado debe poder localizar el premio");
 const redeemed=await a.query("SELECT public.staff_redeem_voucher($1) AS balance",[voucher.rows[0].token]);
 check(redeemed.rows[0].balance===0,"el premio debe descontar exactamente ocho sellos");
 const gone=await a.query("SELECT * FROM public.staff_lookup_voucher($1)",[voucher.rows[0].token]);
 check(gone.rowCount===0,"QR no se puede volver a utilizar");
 await a.query("COMMIT");
 const admin=await a.query("SELECT id FROM auth.users WHERE email='admin@demo.loyally.test'");
 await a.query("BEGIN");await a.query("SET LOCAL ROLE authenticated");
 await a.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[admin.rows[0].id]);
 const dir=await a.query("SELECT * FROM public.business_customer_directory($1)",[voucher.rows[0].business_id]);
 check(dir.rows.some(x=>x.email.includes("XXX")),"los emails de clientes deben estar enmascarados");
 check(!dir.rows.some(x=>x.email==="cliente@demo.loyally.test"),"nunca entregar email real al negocio");
 const quote=await a.query("SELECT * FROM public.business_mail_quote($1)",[voucher.rows[0].business_id]);
 check(Number(quote.rows[0].contacts)===1&&Number(quote.rows[0].total_cents)===1,"cotización por contacto con consentimiento");
 await a.query("COMMIT");
 console.log("OK: 10 comercios, cuatro logins, QR de premio de un solo uso, emails ocultos y tarifa.");
}catch(e){await a.query("ROLLBACK").catch(()=>{});throw e}
finally{a.release();await pool.end()}
