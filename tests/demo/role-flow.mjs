import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import vm from "node:vm";
import ts from "typescript";

// Prueba el mismo adaptador usado por los paneles reales sin conexión al backend.
// No existen fetch, cookies, credenciales ni PostgreSQL en este contexto.
function storage(){
 const values=new Map();
 return {
  getItem:(key)=>values.has(key)?values.get(key):null,
  setItem:(key,value)=>values.set(key,String(value)),
  removeItem:(key)=>values.delete(key)
 };
}
const sessionStorage=storage(),localStorage=storage();
const context={exports:{},window:{sessionStorage,localStorage},crypto:globalThis.crypto,Promise,console};
const source=readFileSync(resolve("lib/demo-local.ts"),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(js,context,{filename:"lib/demo-local.ts"});
const demo=context.exports;
const ids={owner:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",employee:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",customer:"dddddddd-dddd-4ddd-8ddd-dddddddddddd"};
const business="11111111-1111-4111-8111-111111111111";
const token="99999999-9999-4999-8999-999999999999";

demo.enterDemo("gestor");
assert.equal(demo.demoRole(),"gestor");
let user=await demo.demoDb.auth.getUser();
assert.equal(user.data.user.id,ids.owner);
let roles=await demo.demoDb.from("business_members").select("business_id,role,active,businesses(id,name,slug)").eq("user_id",ids.owner).eq("active",true);
assert.equal(roles.data.length,1);
assert.equal(roles.data[0].businesses.name,"Café Noma");

let design=await demo.demoDb.from("businesses").update({accent_color:"#7a54a2",stamp_icon:"burger"}).eq("id",business);
assert.equal(design.error,null);
let businessRow=await demo.demoDb.from("businesses").select("*").eq("id",business).maybeSingle();
assert.equal(businessRow.data.stamp_icon,"burger");
assert.equal(businessRow.data.accent_color,"#7a54a2");

demo.enterDemo("empleado");
user=await demo.demoDb.auth.getUser();
assert.equal(user.data.user.id,ids.employee);
let staffCard=await demo.demoDb.rpc("staff_lookup_card",{p_token:token});
assert.equal(staffCard.error,null);
assert.equal(staffCard.data.length,1);
assert.equal(staffCard.data[0].balance,8);
const issued=await demo.demoDb.rpc("staff_award_card",{p_token:token,p_stamps:2,p_ticket_ref:"DEMO-001"});
assert.equal(issued.error,null);
assert.equal(issued.data,10);
const duplicated=await demo.demoDb.rpc("staff_award_card",{p_token:token,p_stamps:1,p_ticket_ref:"DEMO-001"});
assert.ok(duplicated.error,"El ticket repetido no puede sumar sellos.");

demo.enterDemo("cliente");
user=await demo.demoDb.auth.getUser();
assert.equal(user.data.user.id,ids.customer);
const memberships=await demo.demoDb.from("loyalty_memberships").select("*,businesses(*)").eq("customer_id",ids.customer);
assert.equal(memberships.error,null);
const loyalty=memberships.data.find(m=>m.card_token===token);
assert.equal(loyalty.balance,10,"Los sellos deben aparecer en la cartera real del cliente.");
assert.equal(loyalty.businesses.stamp_icon,"burger","El diseño elegido debe llegar al cliente.");
const forbidden=await demo.demoDb.rpc("admin_user_directory");
assert.ok(forbidden.error,"El cliente no accede a funciones de administración.");
const noAdmins=await demo.demoDb.from("platform_admins").select("user_id").eq("user_id",ids.customer);
assert.equal(noAdmins.data.length,0);

demo.enterDemo("administrador");
const directory=await demo.demoDb.rpc("admin_user_directory");
assert.equal(directory.error,null);
assert.ok(directory.data.length>=4);
const created=await demo.demoDb.rpc("admin_create_business",{p_name:"Pastelería Sol",p_slug:"pasteleria-sol",p_manager_email:"dueño@ejemplo.test"});
assert.equal(created.error,null);
const newlyCreated=await demo.demoDb.from("businesses").select("id,name").eq("slug","pasteleria-sol").maybeSingle();
assert.equal(newlyCreated.data.name,"Pastelería Sol");
const mockSession=await demo.demoDb.auth.getSession();
assert.equal(mockSession.data.session.access_token,"","La cuenta de demostración no debe generar un token de backend.");

demo.resetDemo();
demo.enterDemo("cliente");
const afterReset=await demo.demoDb.from("loyalty_memberships").select("balance").eq("card_token",token).maybeSingle();
assert.equal(afterReset.data.balance,8);
demo.enterDemo("empleado");
const reward=await demo.demoDb.rpc("staff_lookup_voucher",{p_token:"80808080-8080-4808-8808-808080808080"});
assert.equal(reward.data.length,1,"El premio debe poder escanearse.");
const redeem=await demo.demoDb.rpc("staff_redeem_voucher",{p_token:"80808080-8080-4808-8808-808080808080"});
assert.equal(redeem.data,0,"El premio consume ocho sellos.");
const alreadyUsed=await demo.demoDb.rpc("staff_lookup_voucher",{p_token:"80808080-8080-4808-8808-808080808080"});
assert.equal(alreadyUsed.data.length,0,"El QR solo se utiliza una vez.");
demo.leaveDemo();
assert.equal(demo.demoRole(),null);
console.log("OK: acceso por rol, paneles reales, sellos, QR, permisos, reinicio y aislamiento del servidor.");
