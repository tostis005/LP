import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const map=read("components/DirectoryMap.tsx");
const discover=read("app/app/descubrir/page.tsx");
const css=read("app/customer-app.css");

// No competing popup in Leaflet: exactly one conditional business card is rendered by Discover.
assert.doesNotMatch(map,/<Popup\b|\bPopup,|\bPopup\}/,"Leaflet must not open duplicate business popups");
assert.match(map,/eventHandlers=\{\{click:\(\)=>onSelect\?\.\(x\)\}\}/,"Tapping a marker selects its business");
assert.match(map,/bubblingMouseEvents=\{false\}/,"Marker clicks must not close the selected card");
assert.match(map,/useMapEvents\(\{click:\(\)=>onDismiss\?\.\(\)\}\)/,"Tapping empty map area clears selection");
assert.match(map,/l\.id===selectedId/,"Only the selected marker is highlighted");

assert.match(discover,/selectedId\?filtered\.find\(entry=>entry\.id===selectedId\)\|\|null:null/,"No card appears automatically on initial load");
assert.match(discover,/\{selected&&<article className="customer-map-business-card"/,"The business card appears only on selection");
assert.match(discover,/aria-label="Cerrar ficha del negocio"/,"The contextual card is explicitly dismissible");
assert.match(discover,/onDismiss=\{\(\)=>setSelectedId\(null\)\}/,"Map clicks close contextual card");
assert.match(discover,/const mapCenter=useMemo/,"Selecting a marker must not automatically recenter the map");
assert.match(discover,/center=\{mapCenter\}/,"Stable center keeps pan/zoom interactive");
assert.match(discover,/customer-discover-tools/,"The search and filters sit above the map");
assert.match(discover,/className="customer-discover-filter-header"/,"Reward filters get a dedicated toolbar");
assert.match(discover,/className="customer-discover-filter-label">Categorías/,"Category chips have their own clearly labeled row");
assert.ok(discover.indexOf('className="customer-discover-filter-header"')<discover.indexOf('className="customer-map-categories"'),"Reward filters must not float over horizontally scrolled categories");
assert.match(css,/\.workspace-customer \.customer-discover-filterbar \.customer-map-categories\{[^}]*flex-wrap:wrap/,"Business categories must wrap instead of scrolling underneath Filtros");
assert.match(css,/\.workspace-customer \.customer-discover-filterbar \.customer-map-categories\{[^}]*overflow:visible/,"No clipped horizontal chip carousel");
assert.match(css,/\.workspace-customer \.customer-discover-filter-header \.customer-filter-toggle\{[^}]*position:static/,"Filters must not overlay the category row");

assert.ok(discover.indexOf('className="customer-discover-tools"')<discover.indexOf('className="customer-map-stage"'),"Controls must be outside the map");
assert.match(discover,/Ya tengo tarjeta/);
assert.match(discover,/Aún no la tengo/);
assert.match(discover,/customer-filter-toggle/,"Reward filter remains available but compact");
assert.match(discover,/onClick=\{\(\)=>setOpenCardId\(selectedCard\)\}/,"Owned markers open an in-place card modal");
assert.match(discover,/className="customer-map-locate"/,"Geolocation remains available");

assert.match(css,/mapa editorial minimalista/);
assert.match(css,/filter:grayscale\(1\) saturate\(0\)/,"Muted cartography keeps the map professionally neutral");
assert.match(css,/\.customer-map-stage \.loyally-map-pin\.is-owned\{[\s\S]*?background:var\(--color-brand\)!important/,"Owned businesses use Kreyv wine");
assert.match(css,/\.customer-map-stage \.loyally-map-pin\.is-unowned\{[\s\S]*?background:#fff!important/,"Unowned businesses stay outlined on white");
assert.match(css,/\.customer-map-locate\{/,"Location button remains available");
assert.doesNotMatch(discover,/Apple Wallet|Google Wallet|directory-wallet-links/);
console.log("OK: clean greyscale map, no duplicate popups, one dismissible card and clear owned/unowned markers.");
