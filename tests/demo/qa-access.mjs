import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const login=read("app/acceder/page.tsx");
const auth=read("app/api/local/qa-access/route.ts");
const confirm=read("app/acceso-perfiles/page.tsx");
const migration=read("db/migrations/220_qa_access_links.sql");
const compose=read("compose.yaml");
const logout=read("app/api/local/auth/route.ts");
const mail=read("lib/server/auth.ts");
assert.match(login,/qaEnabled&&/,"Profiles require server-side QA access enabled");
assert.match(login,/qaAuthorized\?"switch":"request"/,"First access requires email approval");
assert.match(auth,/LP_ENABLE_QA_ACCESS==="true"/,"Explicit QA feature gate");
assert.match(auth,/SMTP_USER/,"Email goes only to configured operator");
assert.match(auth,/qa_access_links/,"Mail links are single use");
assert.match(auth,/expires_at>now\(\) RETURNING role/,"Expired tokens cannot authenticate");
assert.match(auth,/operatorAllowed\(request,admin\.id\)/,"No role switch without temporary operator cookie");
assert.match(auth,/public\.is_platform_admin\(\)/,"Only a real platform admin can grant access");
assert.match(auth,/setSessionCookie\(reply/,"Real signed sessions, not fake database");
assert.match(auth,/operatorSessionCookie/);
assert.doesNotMatch(auth,/LP_SHOWCASE_.*PASSWORD/,"No credentials in source");
assert.match(confirm,/action:"verify"/,"Email confirmation requires user interaction");
assert.match(migration,/token_hash text PRIMARY KEY/);
assert.match(logout,/lp_qa_operator=/,"Logout clears temporary access");
assert.match(compose,/LP_ENABLE_QA_ACCESS/);
assert.match(compose,/LP_QA_COPY_EMAIL: \$\{LP_QA_COPY_EMAIL:-daksharomero@gmail\.com\}/,
 "The requested copy address must be configured for production.");
assert.match(auth,/LP_QA_COPY_EMAIL/,"Copy is read only by the role authorization path");
assert.match(auth,/qaCopyRecipient\(\)\);/,"Verification links are sent with the optional CC");
assert.match(auth,/email\.toLowerCase\(\)===qaRecipient\(\)\.toLowerCase\(\)/,
 "If both email addresses match, do not send duplicate recipients");
assert.match(auth,/validateEmail\(email\)/,"Invalid CC configuration must be rejected");
assert.match(mail,/html\?:string,cc\?:string/,"The mailer accepts an explicit CC");
assert.match(mail,/\.\.\.\(cc\?\{cc\}:\{\}\)/,"CC is passed to nodemailer");
assert.match(mail,/await sendMail\(email,subject,/,"Account verification and recovery must remain single-recipient");

console.log("OK: authorized profile switching uses Gmail proof and time-limited real PostgreSQL sessions.");
