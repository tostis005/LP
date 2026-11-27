import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const owner=read("components/BusinessWorkspace.tsx");
const app=read("components/AppFrame.tsx");
const ui=read("components/BusinessAutomationPanel.tsx");
const route=read("app/api/local/automations/route.ts");
const migration=read("db/migrations/390_automation_triggers.sql");
const css=read("app/role-app.css");
assert.match(owner,/section==="tarjeta"\|\|section==="designer"\|\|section==="program"\?"card"/,"The public Tarjeta route must not render Inicio");
assert.match(owner,/\{tab==="card"&&<nav className="business-card-tabs"/,"Card design, rules and rewards must be accessible");
for(const name of ['cardArea==="design"','cardArea==="rules"','cardArea==="rewards"'])assert.ok(owner.includes(name),name);
assert.match(owner,/upload\(e\.target\.files\?\.\[0\]\|\|null,"logo_url"\)/,"Logo should be in the same Card section");
assert.match(owner,/max_stamps_per_action/);
assert.match(owner,/max_daily_awards_per_employee/);
assert.match(owner,/card_background/);
assert.match(owner,/saveDesigner/);
assert.doesNotMatch(app,/business-mobile-all-sections/,"No secondary copy of the owner main navigation");
assert.doesNotMatch(owner,/className="owner-start-actions"/,"Inicio must not duplicate the bottom navigation with four shortcuts");
assert.match(owner,/className="owner-start-card-preview"/,"Inicio has a useful card preview instead of duplicate menu items");
assert.match(owner,/owner-start-links/,"Customer list and business details remain accessible from Inicio");
assert.doesNotMatch(ui,/automation-presets|function preset\(|Bienvenida después del alta|Regalo por cinco sellos|Un premio al alcanzar/,"No example or prefilled campaigns");
assert.match(ui,/Sin campañas automáticas|Aún no tienes campañas automáticas/);
for(const kind of ["signup","no_visit","visits","stamps","inactivity","first_redeem"]){
 assert.match(ui,new RegExp('value:"'+kind+'"'),"Real trigger "+kind+" must be available in editor");
 assert.match(migration,new RegExp("'"+kind+"'"),"Trigger "+kind+" must exist in SQL");
}
assert.match(ui,/mode==="edit"/,"Campaign messages should be editable");
assert.match(route,/action==="edit"/,"Editing must reach authenticated backend");
assert.match(migration,/NOT EXISTS\(SELECT 1 FROM public\.loyalty_transactions t/,"No-show trigger must check purchase activity before sending");
assert.match(migration,/FOR UPDATE OF q SKIP LOCKED/,"Worker should lock jobs");
assert.match(migration,/public\.automation_queue\.status <> 'delivered'/,"Inactivity should be sent once per customer");
assert.match(css,/owner-card-brand-upload/);
assert.match(css,/automation-builder-step/);
console.log("OK: Tarjeta routing, unified icons, all card settings and blank actionable campaign flow builder.");


// Background and stamp selection are independent, and all artwork is present.
assert.match(owner,/CARD_BACKGROUNDS/);
assert.match(owner,/Color liso/);
assert.match(owner,/Imagen de fondo/);
assert.match(owner,/Subir fondo personalizado/);
assert.match(owner,/Icono de galería/);
assert.match(owner,/Subir sello propio/);
assert.match(owner,/Elegir color personalizado/);
assert.match(owner,/accent_color:design.color,card_background:design.url,card_text_color:design.textColor/);
assert.match(owner,/biz.stamp_image_url\?<div className="card-upload-choice"/);
assert.match(owner,/Conserva sus colores originales/);
const catalog=read("lib/card-backgrounds.ts");
const backgrounds=[...catalog.matchAll(/"url": "(\/brand\/card-designs\/[^"]+)"/g)].map(x=>x[1]);
assert.equal(backgrounds.length,42);
assert.equal(new Set(backgrounds).size,42);
for(const url of backgrounds)assert.match(read("public"+url),/<svg\b/);
assert.match(read("app/card-designer.css"),/grid-template-columns:repeat\(auto-fill,minmax\(100px,1fr\)\)/);
assert.match(owner,/Guardar diseño/);

assert.equal(backgrounds.filter(url=>url.includes("/gallery-food-")).length,16);
assert.match(owner,/Tipografía del nombre del negocio/);
assert.match(owner,/card_title_font:biz.card_title_font\|\|"default"/);
assert.match(read("components/StampCard.tsx"),/titleFont=\{business.card_title_font\}/);
assert.match(read("components/CustomerCardDeck.tsx"),/cardTitleFont\(b.card_title_font\)/);
