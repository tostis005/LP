import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const owner=read("components/BusinessWorkspace.tsx");
const preview=read("components/StampCard.tsx");
const customer=read("components/LoyaltyCard.tsx");
const chart=read("components/BusinessAnalytics.tsx");
const css=read("app/role-app.css");

assert.doesNotMatch(owner,/className="owner-start-actions"/,"Inicio must not duplicate the four bottom navigation destinations");
assert.match(owner,/className="owner-start-card-preview"/,"Inicio displays the merchant's actual card instead");
assert.match(owner,/MI NEGOCIO/);
assert.match(owner,/owner-start-primary-links/,"Owner management tabs appear above the card");
assert.match(owner,/href="\/negocio\/customers"/,"Clientes is still available as a top tab");
assert.match(owner,/Información del negocio/);

const logo=preview.indexOf('className="stamp-business-logo"');
const name=preview.indexOf('className="stamp-visual-name"');
const stamps=preview.indexOf('<StampGrid total=');
const message=preview.indexOf('className="stamp-visual-message"');
assert.ok(logo>=0&&logo<name&&name<stamps&&stamps<message,
 "Merchant logo precedes name, stamps follow, and custom message comes after the stamps");
assert.match(preview,/className="stamp-qr-white"/);
assert.match(preview,/size=\{240\} includeMargin/,"Card QR has adequate resolution and a scanner-friendly quiet zone");
assert.match(css,/\.stamp-visual-card\.stamp-visual-rebalanced[\s\S]*?aspect-ratio:1\.586/);
assert.match(css,/\.stamp-visual-rebalanced \.stamp-business-logo[\s\S]*?14\.5cqw/);
assert.match(css,/\.stamp-visual-rebalanced \.stamp-grid[\s\S]*?10cqw/);
assert.match(css,/\.stamp-visual-rebalanced \.stamp-qr-white[\s\S]*?max-width:195px/);
assert.match(customer,/className=\{"loyalty-card loyalty-card-rebalanced"/);
assert.match(customer,/className="lc-card-name"/);
assert.match(customer,/className="lc-card-message"/);
assert.match(customer,/className="lc-qr-large"/);

assert.match(chart,/onClick=\{\(\)=>setSelectedIndex\(i\)\}/,"Touching a bar must select it");
assert.match(chart,/onPointerEnter=\{\(\)=>setSelectedIndex\(i\)\}/,"Hovering a bar must select it");
assert.match(chart,/onFocus=\{\(\)=>setSelectedIndex\(i\)\}/,"Keyboard focus must reveal the value");
assert.match(chart,/aria-pressed=\{selectedIndex===i\}/);
assert.match(chart,/className="owner-growth-bar-tooltip"/);
assert.match(chart,/className="owner-growth-picked"/);
assert.match(chart,/reportDateLabel\(chosen\.bucket_start\)/);
console.log("OK: owner Inicio without duplicate shortcuts, logo-first ID-1 cards, enlarged scannable QR and interactive chart values.");
