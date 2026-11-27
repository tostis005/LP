import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {adminSections,isAdminSection,adminDefaultHref,adminNavigation,adminActiveHref,adminBusinessHref,managedBusinessHref} from "../../lib/admin-sections.ts";
const read=(path)=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const workspace=read("components/AdminWorkspace.tsx");
const root=read("app/admin/page.tsx"),route=read("app/admin/[section]/page.tsx"),frame=read("components/AppFrame.tsx");
assert.equal(adminDefaultHref,"/admin/negocios");
assert.match(root,/redirect\(adminDefaultHref\)/);
assert.match(route,/if\(!isAdminSection\(section\)\)notFound\(\)/);
assert.match(route,/<AdminWorkspace section=\{section\}/);
assert.match(workspace,/<AppFrame area="admin"/);
assert.match(workspace,/tab=\{config.tab\}/);
assert.doesNotMatch(workspace,/setTab\(/);
for(const [slug,{tab}] of Object.entries(adminSections)){
 assert.ok(isAdminSection(slug));
 assert.ok(adminNavigation.some(item=>item.href==='/admin/'+slug));
 assert.ok(workspace.includes('tab==="'+tab+'"'));
}
assert.equal(Object.keys(adminSections).length,7);
assert.equal(isAdminSection("no-existe"),false);
assert.equal(isAdminSection("constructor"),false);
assert.match(frame,/adminActiveHref\(pathname\)/);
assert.match(frame,/area==="admin"\?admin/);
console.log("Admin routes: seven independent sections, canonical entry, deep links and existing permissions.");

assert.doesNotMatch(workspace,/workspace-section-menu/);
assert.match(frame,/admin:adminNavigation\.map/);
assert.match(read("components/AppBottomNav.tsx"),/admin:adminNavigation\.map/);
assert.match(workspace,/adminBusinessHref\(b.id\)/);
const id="12345678-1234-1234-1234-123456789abc";
assert.equal(adminActiveHref(adminBusinessHref(id,"tarjeta")),"/admin/negocios");
assert.equal(managedBusinessHref(id,"/negocio/poster"),adminBusinessHref(id,"poster"));
assert.equal(managedBusinessHref(undefined,"/negocio/poster"),"/negocio/poster");
assert.match(read("components/AdminBusinessWorkspace.tsx"),/AppFrame area="admin"/);
assert.match(read("components/BusinessWorkspace.tsx"),/account.admin&&!!adminBusinessId/);
assert.match(read("components/BusinessWorkspace.tsx"),/managedBusinessHref/);

const directory=read("components/AdminMarketingUsers.tsx"),header=read("components/DirectoryTable.tsx"),api=read("app/api/local/admin/marketing-users/route.ts");
assert.equal((workspace.match(/<AdminMarketingUsers\/>/g)||[]).length,1);
assert.doesNotMatch(workspace,/Directorio global de usuarios/);
assert.match(directory,/if\(editing\)return <section className="panel-card marketing-user-editor"/);
assert.match(directory,/className="marketing-active-control"/);
assert.match(directory,/filter:"select",options:Object.entries\(roles\)/);
assert.match(directory,/Ver programas/);
assert.match(directory,/Editar usuario/);
assert.match(header,/aria-sort/);
assert.match(header,/directory-filter-row/);
assert.match(api,/admin_user_directory\(\)/);
assert.match(api,/byId.get\(u.id\)/);
assert.match(workspace,/<DirectoryHead columns=\{businessColumns\}/);
assert.match(workspace,/<DirectoryHead columns=\{leadColumns\}/);
const {selectDirectoryRows}=await import("../../lib/table-directory.ts");
const sample=[{name:"Álvaro",role:"customer",n:10},{name:"Ana",role:"marketing",n:2},{name:"Ángel",role:"marketing",n:3}];
const cols=[{key:"name",value:r=>r.name},{key:"role",value:r=>r.role,filter:"select"},{key:"n",value:r=>r.n,filter:"number"}];
assert.deepEqual(selectDirectoryRows(sample,cols,{name:"alvaro"},{key:"name",direction:"asc"}).map(r=>r.n),[10]);
assert.deepEqual(selectDirectoryRows(sample,cols,{role:"marketing"},{key:"n",direction:"desc"}).map(r=>r.n),[3,2]);
assert.deepEqual(selectDirectoryRows(sample,cols,{n:"2"},{key:"n",direction:"asc"}).map(r=>r.name),["Ana"]);
assert.deepEqual(selectDirectoryRows(sample,cols,{},{key:"n",direction:"asc"}).map(r=>r.n),[2,3,10]);

const {emptyScope,appendScope,scopesForSave}=await import("../../lib/marketing-scopes.ts");
const leon={...emptyScope,country_code:"MX",state_code:"11",municipality_code:"020"};
assert.deepEqual(scopesForSave([],leon),[leon],"Save includes selected but not yet added geographic scope");
assert.deepEqual(scopesForSave([],emptyScope),[],"An empty draft must not grant global permissions");
assert.deepEqual(scopesForSave([leon],leon),[leon],"Do not duplicate selected scopes");
assert.deepEqual(appendScope([leon],emptyScope),[leon,emptyScope],"Global permission is explicit");
assert.match(directory,/scopes:scopesForSave\(scopes,draft\)/);
assert.match(directory,/Contraseña inicial \(opcional\)/);
assert.match(api,/hashPassword\(initialPassword\|\|newPassword\|\|randomBytes/);
assert.match(api,/crm_admin_provision_marketing/);
assert.match(read("app/acceder/page.tsx"),/resetPasswordForEmail/);
assert.match(read("app/marketing/page.tsx"),/href="\/restablecer-clave"/);
const crm=read("components/AdminCrm.tsx");
assert.match(crm,/importOfficial\("11020","León"\)/);
assert.match(crm,/importOfficial\("11020","León",leonFile\)/);
assert.match(read("lib/server/denue-download.ts"),/11020.*denue_11_0525_csv.zip/);

assert.match(directory,/marketing-users\?view=users/);
assert.match(directory,/marketing-users\?view=regions/);
assert.match(api,/admin_reset_staff_password/);


// One marketing editor action and one save, with explicit password validation.
assert.match(directory,/existing&&<section className="marketing-editor-section form-stack" aria-label="Contraseña de acceso"/);
assert.doesNotMatch(directory,/Editar permisos|Guarda la contraseña en el apartado superior/);
assert.match(directory,/passwordValidation\(newPassword,confirmPassword,true\)/);
assert.match(directory,/type="submit" disabled=\{busy\}>\{busy\?"Guardando…":existing\?"Guardar cambios"/);
assert.match(directory,/style=\{\{display:"grid",gap:24\}\}/);
assert.match(directory,/Confirmar contraseña/);
assert.match(directory,/passwordError&&<p role="alert"/);
assert.match(api,/if\(newPassword\)await c\.query\("SELECT public\.admin_reset_staff_password\(\$1::uuid,\$2\)",\[result\.id,hash\]\)/);
assert.match(api,/passwordChanged:!!newPassword/);
assert.match(api,/if\(!initialPassword&&!newPassword&&v\.invite===true\)/);

assert.match(directory,/method:existing\?"PUT":"POST"/);
assert.match(directory,/key:"business",label:"Negocio"/);
assert.match(api,/public.admin_account_details\(\)/);
assert.match(api,/public.admin_edit_account\(/);

const userPage=read("app/admin/usuarios/[id]/page.tsx");
const userFrame=read("components/AdminUserPage.tsx");
assert.match(userPage,/AdminUserPage id=\{id\}/);
assert.match(userFrame,/AppFrame area="admin"/);
assert.match(directory,/href=\{"\/admin\/usuarios\/"\+encodeURIComponent\(u.id\)\}/);
assert.match(directory,/hasPrograms&&<button/);
assert.match(directory,/aria-expanded=\{expanded\}/);
assert.match(directory,/expanded&&hasPrograms&&<tr className="admin-user-program-row"/);
assert.doesNotMatch(directory,/focusUser&&<div className="admin-inspector"/);
assert.match(read("app/workspace.css"),/admin-user-row-actions\{display:flex;align-items:center;justify-content:flex-end/);

const {staffBusinesses,loyaltySubscriptions,matchesBusiness,staffBusinessNames}=await import("../../lib/admin-user-affiliations.ts");
const link=(id,role,active=true)=>({id,name:id,role,active});
const people=[
 {role:"owner",business_links:[link("b1","owner"),link("b2","customer")]},
 {role:"employee",business_links:[link("b1","employee")]},
 {role:"manager",business_links:[link("b2","manager")]},
 {role:"customer",business_links:[link("b1","customer"),link("b2","customer")]},
 {role:"marketing",business_links:[link("b1","customer")]},
 {role:"admin",business_links:[link("b1","customer")]},
 {role:"employee",business_links:[link("b1","employee",false)]}
];
const businessCol=[{key:"business",value:staffBusinessNames,filter:"select",matches:matchesBusiness}];
assert.deepEqual(selectDirectoryRows(people,businessCol,{business:"b1"},{key:"business",direction:"asc"}).map(u=>u.role),["owner","employee"]);
assert.deepEqual(selectDirectoryRows(people,businessCol,{business:"b2"},{key:"business",direction:"asc"}).map(u=>u.role),["manager"]);
assert.equal(selectDirectoryRows(people,businessCol,{business:"b"},{key:"business",direction:"asc"}).length,0);
assert.equal(staffBusinesses(people[3]).length,0);
assert.equal(loyaltySubscriptions(people[3]).length,2);
assert.equal(staffBusinessNames(people[0]),"b1");
assert.equal(loyaltySubscriptions(people[0]).length,1);
assert.match(directory,/matches:matchesBusiness/);
assert.match(directory,/hasPrograms=loyaltySubscriptions\(u\).length>0/);
assert.match(directory,/staffBusinessNames\(u\)/);
assert.match(directory,/staffBusinesses\(u\).map/);
