import assert from "node:assert/strict";
import pg from "pg";
import {randomBytes,createHash} from "node:crypto";
const common={host:process.env.PGHOST||"127.0.0.1",port:Number(process.env.PGPORT||5432),
 database:process.env.POSTGRES_DB};
const admin=new pg.Pool({...common,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD});
const api=new pg.Pool({...common,user:"lp_api",password:process.env.APP_DB_PASSWORD});
const auth=new pg.Pool({...common,user:"lp_auth",password:process.env.AUTH_DB_PASSWORD});
try{
 const testUser=(await admin.query("SELECT id FROM auth.users WHERE email='cliente@demo.loyally.test'")).rows[0];
 assert.ok(testUser?.id,"Expected sandbox customer");
 const token=randomBytes(32).toString("base64url");
 const hash=createHash("sha256").update(token).digest("hex");
 await auth.query("INSERT INTO auth.oauth_attempts(state_hash,provider,nonce,code_verifier,return_to) VALUES($1,'google',$2,$3,'/app')",[hash,"unit-test-nonce","unit-test-pkce"]);
 const consumed=await auth.query("DELETE FROM auth.oauth_attempts WHERE state_hash=$1 AND provider='google' AND expires_at>now() RETURNING nonce,code_verifier",[hash]);
 assert.equal(consumed.rows[0]?.nonce,"unit-test-nonce");
 const replay=await auth.query("DELETE FROM auth.oauth_attempts WHERE state_hash=$1 RETURNING state_hash",[hash]);
 assert.equal(replay.rowCount,0,"OAuth state must be single-use");
 await auth.query("INSERT INTO auth.oauth_identities(provider,subject,user_id) VALUES('google','test-sub',$1)",[testUser.id]);
 const identity=await auth.query("SELECT user_id FROM auth.oauth_identities WHERE provider='google' AND subject='test-sub'");
 assert.equal(identity.rows[0]?.user_id,testUser.id);
 await assert.rejects(()=>auth.query("INSERT INTO auth.oauth_identities(provider,subject,user_id) VALUES('google','test-sub',$1)",[testUser.id]),e=>e.code==="23505");
 await assert.rejects(()=>auth.query("INSERT INTO auth.oauth_identities(provider,subject,user_id) VALUES('apple','test-sub',$1)",["00000000-0000-0000-0000-000000000000"]),e=>e.code==="23503");
 // The client API is not allowed to expose federated IDs or the login attempt table.
 await assert.rejects(()=>api.query("SELECT * FROM auth.oauth_identities"),e=>["42501","42P01"].includes(e.code));
 await assert.rejects(()=>api.query("SELECT * FROM auth.oauth_attempts"),e=>["42501","42P01"].includes(e.code));
 await auth.query("DELETE FROM auth.oauth_identities WHERE provider='google' AND subject='test-sub'");
 console.log("OK: OAuth state one-use, identity mapping constraints, and no app API grants.");
}finally{await Promise.all([admin.end(),api.end(),auth.end()]);}
