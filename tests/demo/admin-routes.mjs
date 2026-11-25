import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {adminSections,isAdminSection,adminDefaultHref} from "../../lib/admin-sections.ts";
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
 assert.ok(workspace.includes('href="/admin/'+slug+'"'));
 assert.ok(workspace.includes('tab==="'+tab+'"'));
}
assert.equal(Object.keys(adminSections).length,7);
assert.equal(isAdminSection("no-existe"),false);
assert.equal(isAdminSection("constructor"),false);
assert.match(frame,/area==="admin"&&pathname\.startsWith\("\/admin\/"\)/);
assert.match(frame,/area==="admin"\?admin/);
console.log("Admin routes: seven independent sections, canonical entry, deep links and existing permissions.");
