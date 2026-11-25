"use client";
import {useEffect,useRef,useState} from "react";

// ISO 3166-1 regions and international calling codes. Shared codes (e.g. +1)
// retain the selected region; the national number includes the area code.
const groups:Record<string,string>={
 "1":"US CA AG AI AS BB BM BS DM DO GD GU JM KN KY LC MP MS PR SX TC TT VC VG VI",
 "7":"RU KZ","20":"EG","27":"ZA","30":"GR","31":"NL","32":"BE","33":"FR","34":"ES","36":"HU","39":"IT VA","40":"RO","41":"CH","43":"AT","44":"GB GG IM JE","45":"DK","46":"SE","47":"NO SJ","48":"PL","49":"DE",
 "51":"PE","52":"MX","53":"CU","54":"AR","55":"BR","56":"CL","57":"CO","58":"VE","60":"MY","61":"AU CC CX","62":"ID","63":"PH","64":"NZ","65":"SG","66":"TH","81":"JP","82":"KR","84":"VN","86":"CN","90":"TR","91":"IN","92":"PK","93":"AF","94":"LK","95":"MM","98":"IR",
 "211":"SS","212":"MA EH","213":"DZ","216":"TN","218":"LY","220":"GM","221":"SN","222":"MR","223":"ML","224":"GN","225":"CI","226":"BF","227":"NE","228":"TG","229":"BJ","230":"MU","231":"LR","232":"SL","233":"GH","234":"NG","235":"TD","236":"CF","237":"CM","238":"CV","239":"ST","240":"GQ","241":"GA","242":"CG","243":"CD","244":"AO","245":"GW","246":"IO","247":"AC","248":"SC","249":"SD","250":"RW","251":"ET","252":"SO","253":"DJ","254":"KE","255":"TZ","256":"UG","257":"BI","258":"MZ","260":"ZM","261":"MG","262":"RE YT","263":"ZW","264":"NA","265":"MW","266":"LS","267":"BW","268":"SZ","269":"KM","290":"SH TA","291":"ER","297":"AW","298":"FO","299":"GL",
 "350":"GI","351":"PT","352":"LU","353":"IE","354":"IS","355":"AL","356":"MT","357":"CY","358":"FI AX","359":"BG","370":"LT","371":"LV","372":"EE","373":"MD","374":"AM","375":"BY","376":"AD","377":"MC","378":"SM","380":"UA","381":"RS","382":"ME","383":"XK","385":"HR","386":"SI","387":"BA","389":"MK","420":"CZ","421":"SK","423":"LI",
 "500":"FK","501":"BZ","502":"GT","503":"SV","504":"HN","505":"NI","506":"CR","507":"PA","508":"PM","509":"HT","590":"GP BL MF","591":"BO","592":"GY","593":"EC","594":"GF","595":"PY","596":"MQ","597":"SR","598":"UY","599":"CW BQ",
 "670":"TL","672":"NF AQ","673":"BN","674":"NR","675":"PG","676":"TO","677":"SB","678":"VU","679":"FJ","680":"PW","681":"WF","682":"CK","683":"NU","685":"WS","686":"KI","687":"NC","688":"TV","689":"PF","690":"TK","691":"FM","692":"MH","850":"KP","852":"HK","853":"MO","855":"KH","856":"LA","880":"BD","886":"TW",
 "960":"MV","961":"LB","962":"JO","963":"SY","964":"IQ","965":"KW","966":"SA","967":"YE","968":"OM","970":"PS","971":"AE","972":"IL","973":"BH","974":"QA","975":"BT","976":"MN","977":"NP","992":"TJ","993":"TM","994":"AZ","995":"GE","996":"KG","998":"UZ"
};
const dialing=Object.fromEntries(Object.entries(groups).flatMap(([code,regions])=>regions.split(" ").map(region=>[region,code]))) as Record<string,string>;
const names=new Intl.DisplayNames(["es"],{type:"region"});
const flag=(region:string)=>String.fromCodePoint(...Array.from(region,c=>127397+c.charCodeAt(0)));
const regions=Object.keys(dialing).sort((a,b)=>(names.of(a)||a).localeCompare(names.of(b)||b,"es"));
const timezoneRegions:Record<string,string>={
 "America/Mexico_City":"MX","America/Tijuana":"MX","America/Cancun":"MX","America/Merida":"MX","America/Monterrey":"MX","America/Matamoros":"MX","America/Hermosillo":"MX","America/Chihuahua":"MX","America/Ciudad_Juarez":"MX","America/Mazatlan":"MX","America/Bahia_Banderas":"MX","America/Ojinaga":"MX",
 "Europe/Madrid":"ES","Atlantic/Canary":"ES","Africa/Ceuta":"ES","Africa/Johannesburg":"ZA","America/Bogota":"CO","America/Lima":"PE","America/Santiago":"CL","America/Buenos_Aires":"AR","America/Sao_Paulo":"BR","America/Caracas":"VE","America/Guatemala":"GT","America/Costa_Rica":"CR","America/Panama":"PA","America/El_Salvador":"SV","America/Tegucigalpa":"HN","America/Managua":"NI","America/Havana":"CU","America/Santo_Domingo":"DO","America/Puerto_Rico":"PR","America/Asuncion":"PY","America/Montevideo":"UY","America/La_Paz":"BO","America/Guayaquil":"EC","America/New_York":"US","America/Los_Angeles":"US","America/Chicago":"US","America/Denver":"US","America/Phoenix":"US","America/Toronto":"CA","America/Vancouver":"CA","Europe/London":"GB","Europe/Paris":"FR","Europe/Berlin":"DE","Europe/Rome":"IT","Europe/Lisbon":"PT","Europe/Amsterdam":"NL","Europe/Brussels":"BE"
};
function suggestedRegion(){
 const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
 if(timezoneRegions[zone])return timezoneRegions[zone];
 if(zone.startsWith("America/Argentina/"))return "AR";
 if(zone.startsWith("Australia/"))return "AU";
 for(const language of navigator.languages||[navigator.language]){
  try{const region=new Intl.Locale(language).region;if(region&&dialing[region])return region;}catch{}
 }
 return "MX";
}
function regionForPhone(value:string,preferred:string){
 if(value.startsWith("+"+dialing[preferred]))return preferred;
 const code=Object.keys(groups).sort((a,b)=>b.length-a.length).find(c=>value.startsWith("+"+c));
 return code?groups[code].split(" ")[0]:preferred;
}
export function PhoneCountryField({value,onChange,required=false,label="WhatsApp (opcional)",locate=false}:{value:string;onChange:(value:string)=>void;required?:boolean;label?:string;locate?:boolean}){
 const [country,setCountry]=useState(()=>regionForPhone(value,"MX"));
 const touched=useRef(false),latest=useRef(value);latest.current=value;
 const code=dialing[country];
 const national=value.startsWith("+"+code)?value.slice(code.length+1):value.replace(/^\+/,"");
 useEffect(()=>{
  if(value.startsWith("+"))setCountry(current=>regionForPhone(value,current));
 },[value]);
 useEffect(()=>{
  if(latest.current)return;
  if(!touched.current)setCountry(suggestedRegion());
  if(!locate||!navigator.geolocation||!navigator.permissions)return;
  let alive=true;
  // Never request location permission merely to fill a telephone field.
  navigator.permissions.query({name:"geolocation"}).then(permission=>{
   if(!alive||permission.state!=="granted")return;
   navigator.geolocation.getCurrentPosition(async position=>{
    try{
     const lat=Math.round(position.coords.latitude*10)/10,lng=Math.round(position.coords.longitude*10)/10;
     const response=await fetch("/api/local/geocode",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({countryOnly:true,lat,lng})});
     if(!response.ok)return;
     const data=await response.json() as {country?:string};
     if(alive&&!touched.current&&!latest.current&&data.country&&dialing[data.country])setCountry(data.country);
    }catch{}
   },()=>{},{maximumAge:600000,timeout:5000});
  }).catch(()=>{});
  return()=>{alive=false};
 },[locate]);
 function changeCountry(next:string){
  touched.current=true;setCountry(next);
  if(national)onChange("+"+dialing[next]+national);
 }
 function changeNumber(raw:string){
  touched.current=true;
  if(raw.trim().startsWith("+")){
   const full="+"+raw.replace(/\D/g,"");
   if(!Object.keys(groups).some(c=>full.startsWith("+"+c)))return;
   const next=regionForPhone(full,country);
   setCountry(next);onChange(full);return;
  }
  const digits=raw.replace(/\D/g,"");
  onChange(digits?"+"+code+digits:"");
 }
 return <div style={{display:"grid",gap:8}}>
  <label>País del teléfono
   <select aria-label="País del teléfono" autoComplete="tel-country-code" value={country} onChange={e=>changeCountry(e.target.value)}>
    {regions.map(region=><option key={region} value={region}>{flag(region)} {names.of(region)||region} (+{dialing[region]})</option>)}
   </select>
  </label>
  <label>{label}
   <div style={{display:"flex",alignItems:"center",gap:8}}>
    <span aria-hidden="true" style={{whiteSpace:"nowrap",fontWeight:600}}>+{code}</span>
    <input style={{minWidth:0,flex:1}} type="tel" inputMode="tel" autoComplete="tel-national" required={required}
     value={national} onChange={e=>changeNumber(e.target.value)} placeholder="Número de teléfono" pattern={"[0-9]{"+Math.max(1,8-code.length)+","+(15-code.length)+"}"}/>
   </div>
   <small>Escribe el número sin el código del país. Puedes cambiar el país si lo necesitas.</small>
  </label>
 </div>;
}
