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
