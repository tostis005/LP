import {smtpReady} from "@/lib/server/auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export function GET(){
 const email=process.env.LP_ENABLE_MARKETING_SEND==="true"&&smtpReady();
 const whatsapp=process.env.LP_ENABLE_WHATSAPP_SEND==="true"&&!!process.env.WHATSAPP_ACCESS_TOKEN&&
  !!process.env.WHATSAPP_PHONE_NUMBER_ID&&!!process.env.WHATSAPP_MARKETING_TEMPLATE;
 return Response.json({
  email,whatsapp,
  template_name:whatsapp?process.env.WHATSAPP_MARKETING_TEMPLATE:"",
  template_language:whatsapp?(process.env.WHATSAPP_TEMPLATE_LANGUAGE||"es_MX"):""
 },{headers:{"Cache-Control":"no-store"}});
}
