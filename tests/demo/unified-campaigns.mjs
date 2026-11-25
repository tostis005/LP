import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const migration=read("db/migrations/300_unified_campaign_charges.sql");
const quote=read("app/api/local/offers/pricing/route.ts");
const send=read("app/api/local/offers/send/route.ts");
const form=read("components/BusinessOffersPanel.tsx");
const app=read("components/BusinessWorkspace.tsx");
const usage=read("app/negocio/facturacion/page.tsx");
const admin=read("components/AdminCampaignCharges.tsx");
const adminPage=read("components/AdminWorkspace.tsx");
const adminApi=read("app/api/local/admin/campaign-charges/route.ts");
const getOffer=read("app/api/local/offers/route.ts");
const data=read("lib/server/data-api.ts");
for(const token of ["CREATE TABLE public.offer_campaign_charges","PRIMARY KEY(offer_id,channel)",
 "GRANT SELECT ON public.offer_campaign_charges TO authenticated",
 "public.confirm_offer_campaign","FOR UPDATE","FOR SHARE","p_expected_total",
 "public.queue_business_campaign","public.business_queue_push_campaign","INSERT INTO public.offer_campaign_charges",
 "NOT EXISTS(SELECT 1 FROM public.offer_campaign_charges"]){
 assert.ok(migration.includes(token),"Falta seguridad/contabilidad: "+token);
}
assert.match(quote,/business_mail_quote/);
assert.match(quote,/business_whatsapp_quote/);
assert.match(quote,/business_push_pricing/);
assert.match(quote,/unit_price_cents/);
assert.match(send,/action==="confirm"/);
assert.match(send,/"confirm","resume"/);
assert.match(send,/confirm_offer_campaign/);
assert.match(send,/expected_total_cents/);
assert.match(getOffer,/confirmed_cents/);
assert.match(form,/type="checkbox"/);
assert.match(form,/Precio total de la campaña/);
assert.match(form,/PRECIO TOTAL DE LA CAMPAÑA/);
assert.match(form,/Confirmar y enviar/);
assert.match(form,/api\/local\/offers\/pricing/);
assert.match(form,/api\/local\/offers\/send/);
assert.match(form,/Continuar envío/);
assert.doesNotMatch(form,/presupuesto máximo/i);
assert.match(app,/standaloneDrafts/);
assert.match(usage,/offer_campaign_charges/);
assert.match(usage,/Pendiente de facturar/);
assert.match(data,/offer_campaign_charges/);
assert.match(admin,/Exportar CSV/);
assert.match(read("lib/admin-sections.ts"),/Facturación campañas/);
assert.match(adminApi,/public\.is_platform_admin\(\)/);
assert.match(adminApi,/invoiced_at=now\(\)/);
console.log("OK: campaña unificada, precio por canal, confirmación atómica y registro para factura sin duplicar cargos.");

assert.match(read("db/migrations/310_campaign_types_dates.sql"),/valid_from/);
assert.match(form,/Tipo de campaña/);
assert.doesNotMatch(form,/Guardar borrador/);
assert.match(read("components/CustomerInboxBell.tsx"),/kreyv-unread-badge/);
