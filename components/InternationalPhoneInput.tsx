"use client";
import {useId,useMemo,useRef,useState} from "react";

// ISO 3166 territories with public international calling codes.
// Shared numbering plans (e.g. +1 and +7) intentionally retain their shared prefix.
const dialing="MX:52 US:1 CA:1 AG:1 AI:1 AS:1 BB:1 BM:1 BS:1 DM:1 DO:1 GD:1 GU:1 JM:1 KN:1 KY:1 LC:1 MP:1 MS:1 PR:1 SX:1 TC:1 TT:1 VC:1 VG:1 VI:1 RU:7 KZ:7 EG:20 ZA:27 GR:30 NL:31 BE:32 FR:33 ES:34 HU:36 IT:39 RO:40 CH:41 AT:43 GB:44 GG:44 IM:44 JE:44 DK:45 SE:46 NO:47 SJ:47 PL:48 DE:49 PE:51 CU:53 AR:54 BR:55 CL:56 CO:57 VE:58 MY:60 AU:61 CC:61 CX:61 ID:62 PH:63 NZ:64 SG:65 TH:66 JP:81 KR:82 VN:84 CN:86 TR:90 IN:91 PK:92 AF:93 LK:94 MM:95 IR:98 SS:211 MA:212 EH:212 DZ:213 TN:216 LY:218 GM:220 SN:221 MR:222 ML:223 GN:224 CI:225 BF:226 NE:227 TG:228 BJ:229 MU:230 LR:231 SL:232 GH:233 NG:234 TD:235 CF:236 CM:237 CV:238 ST:239 GQ:240 GA:241 CG:242 CD:243 AO:244 GW:245 IO:246 AC:247 SC:248 SD:249 RW:250 ET:251 SO:252 DJ:253 KE:254 TZ:255 UG:256 BI:257 MZ:258 ZM:260 MG:261 RE:262 YT:262 ZW:263 NA:264 MW:265 LS:266 BW:267 SZ:268 KM:269 SH:290 TA:290 ER:291 AW:297 FO:298 GL:299 GI:350 PT:351 LU:352 IE:353 IS:354 AL:355 MT:356 CY:357 FI:358 AX:358 BG:359 LT:370 LV:371 EE:372 MD:373 AM:374 BY:375 AD:376 MC:377 SM:378 UA:380 RS:381 ME:382 XK:383 HR:385 SI:386 BA:387 MK:389 CZ:420 SK:421 LI:423 FK:500 BZ:501 GT:502 SV:503 HN:504 NI:505 CR:506 PA:507 PM:508 HT:509 GP:590 BL:590 MF:590 BO:591 GY:592 EC:593 GF:594 PY:595 MQ:596 SR:597 UY:598 CW:599 BQ:599 TL:670 NF:672 BN:673 NR:674 PG:675 TO:676 SB:677 VU:678 FJ:679 PW:680 WF:681 CK:682 NU:683 WS:685 KI:686 NC:687 TV:688 PF:689 TK:690 FM:691 MH:692 KP:850 HK:852 MO:853 KH:855 LA:856 BD:880 TW:886 MV:960 LB:961 JO:962 SY:963 IQ:964 KW:965 SA:966 YE:967 OM:968 PS:970 AE:971 IL:972 BH:973 QA:974 BT:975 MN:976 NP:977 TJ:992 TM:993 AZ:994 GE:995 KG:996 UZ:998 VA:39";
const countries=dialing.split(" ").map(entry=>{const [iso,dial]=entry.split(":");return {iso,dial};});
type Country=(typeof countries)[number];
const mexico=countries.find(c=>c.iso==="MX")!;
const searchKey=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const flag=(iso:string)=>String.fromCodePoint(...[...iso].map(c=>0x1f1e6+c.charCodeAt(0)-65));
function matchingCountry(value:string,preferred:Country){
 if(!value||value.startsWith("+"+preferred.dial))return preferred;
 return [...countries].sort((a,b)=>b.dial.length-a.dial.length).find(c=>value.startsWith("+"+c.dial))||preferred;
}
export function InternationalPhoneInput({value,onChange,label,required=false,language="es"}:{value:string;onChange:(value:string)=>void;label:string;required?:boolean;language?:"es"|"en"}){
 const id=useId();
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),searchInput=useRef<HTMLInputElement>(null);
 const [open,setOpen]=useState(false),[query,setQuery]=useState("");
 const [preferred,setPreferred]=useState<Country>(()=>matchingCountry(value,mexico));
 const country=matchingCountry(value,preferred);
 const national=value.startsWith("+"+country.dial)?value.slice(country.dial.length+1):value.replace(/\D/g,"");
 const options=useMemo(()=>{
  const names=new Intl.DisplayNames([language],{type:"region"});
  const otherNames=new Intl.DisplayNames([language==="es"?"en":"es"],{type:"region"});
  const collator=new Intl.Collator(language);
  return countries.map(c=>({...c,name:names.of(c.iso)||c.iso,otherName:otherNames.of(c.iso)||c.iso})).sort((a,b)=>a.iso==="MX"?-1:b.iso==="MX"?1:collator.compare(a.name,b.name));
 },[language]);
 const currentName=options.find(c=>c.iso===country.iso)?.name||country.iso;
 const term=searchKey(query);
 const filtered=options.filter(c=>!term||[c.name,c.otherName,c.iso,"+"+c.dial,c.dial].some(v=>searchKey(v).includes(term)));
 function openPicker(){setQuery("");const modal=dialog.current;if(!modal||modal.open)return;modal.showModal();setOpen(true);searchInput.current?.focus();}
 function closePicker(){dialog.current?.close();}
 function pickerClosed(){setOpen(false);setQuery("");trigger.current?.focus();}
 function changeCountry(iso:string){
  const next=countries.find(c=>c.iso===iso)||mexico;
  setPreferred(next);
  const digits=national.slice(0,15-next.dial.length);
  onChange(digits?"+"+next.dial+digits:"");
 }
 function changeNumber(raw:string){
  if(raw.trim().startsWith("+")){
   const full="+"+raw.replace(/\D/g,"").slice(0,15);
   const next=matchingCountry(full,country);
   if(full.startsWith("+"+next.dial)){setPreferred(next);onChange(full.length>next.dial.length+1?full:"");return;}
  }
  const digits=raw.replace(/\D/g,"").slice(0,15-country.dial.length);
  onChange(digits?"+"+country.dial+digits:"");
 }
 return <div className="international-phone" role="group" aria-labelledby={id+"-label"}>
  <label id={id+"-label"} htmlFor={id}>{label}</label>
  <div className="international-phone-row">
   <button ref={trigger} type="button" className="international-phone-country" aria-haspopup="dialog" aria-expanded={open} aria-controls={id+"-countries"} aria-label={(language==="en"?"Change country: ":"Cambiar país: ")+currentName+" (+"+country.dial+")"} onClick={openPicker}>
    <span aria-hidden="true" className="international-phone-prefix"><span className="international-phone-flag">{flag(country.iso)}</span><span>+{country.dial}</span></span>
   </button>
   <input id={id} type="tel" inputMode="tel" autoComplete="tel-national" required={required} value={national} onChange={e=>changeNumber(e.target.value)} placeholder={country.iso==="MX"?"55 1234 5678":language==="en"?"Phone number":"Número de teléfono"} pattern={`[0-9]{${Math.max(1,8-country.dial.length)},${15-country.dial.length}}`} />
  </div>
  <dialog ref={dialog} id={id+"-countries"} className="international-phone-dialog" aria-labelledby={id+"-country-title"} onClose={pickerClosed} onClick={e=>{if(e.target===e.currentTarget)closePicker();}}>
   <div className="international-phone-picker">
    <div className="international-phone-picker-header"><h2 id={id+"-country-title"}>{language==="en"?"Select country":"Selecciona tu país"}</h2><button type="button" className="international-phone-close" onClick={closePicker} aria-label={language==="en"?"Close":"Cerrar"}>×</button></div>
    <input ref={searchInput} className="international-phone-search" type="search" autoComplete="off" aria-label={language==="en"?"Search country or calling code":"Buscar país o prefijo"} placeholder={language==="en"?"Search country or calling code":"Buscar país o prefijo"} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();if(filtered.length===1){changeCountry(filtered[0].iso);closePicker();}}}}/>
    <div className="international-phone-options" role="group" aria-label={language==="en"?"Countries":"Países"}>
     {filtered.map(c=><button key={c.iso} type="button" className={"international-phone-option"+(c.iso===country.iso?" selected":"")} aria-pressed={c.iso===country.iso} onClick={()=>{changeCountry(c.iso);closePicker();}}><span className="international-phone-flag" aria-hidden="true">{flag(c.iso)}</span><span className="international-phone-name">{c.name}</span><span className="international-phone-dial">+{c.dial}</span>{c.iso===country.iso&&<span aria-hidden="true" className="international-phone-check">✓</span>}</button>)}
     {!filtered.length&&<p className="international-phone-no-results" role="status">{language==="en"?"No countries found":"No se encontraron países"}</p>}
    </div>
   </div>
  </dialog>
  <style jsx>{`
   .international-phone{display:grid;gap:7px;min-width:0}
   .international-phone-row{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:stretch;gap:8px}
   .international-phone-row>input{min-width:0;width:100%;margin:0}
   .international-phone-country{position:relative;display:flex;align-items:center;border:1.5px solid var(--color-bg-2,#e4dce0);border-radius:12px;background:#fff;color:var(--color-text,#231b20);min-width:82px;cursor:pointer;padding:0;justify-content:center;font:inherit;box-shadow:none}
   .international-phone-prefix{display:flex;align-items:center;gap:7px;padding:0 10px;white-space:nowrap;font-size:14px;font-weight:600}
   .international-phone-flag{font-size:20px;line-height:1}
   .international-phone-country:focus-visible{outline:2px solid var(--color-brand,#79243f);outline-offset:2px}
   .international-phone-dialog{position:fixed;inset:0;margin:auto;width:min(420px,calc(100vw - 24px));max-width:calc(100vw - 24px);max-height:85dvh;padding:0;border:1px solid #e4dce0;border-radius:18px;background:#fff;color:#231b20;box-shadow:0 18px 60px #0004;overflow:hidden}
   .international-phone-dialog::backdrop{background:#17101980}
   .international-phone-picker{display:flex;flex-direction:column;gap:12px;padding:18px;max-height:85dvh;box-sizing:border-box}
   .international-phone-picker-header{display:flex;justify-content:space-between;align-items:center;gap:12px}
   .international-phone-picker-header h2{margin:0;color:#231b20;font-size:18px;font-weight:700}
   .international-phone-close{border:0;background:transparent;color:#231b20;font-size:28px;line-height:1;padding:4px 10px;cursor:pointer;box-shadow:none}
   .international-phone-search{flex:none;width:100%;min-width:0;margin:0;padding:11px 12px;border:1px solid #cfc6cb;border-radius:10px;background:#fff;color:#231b20;font-size:16px;box-sizing:border-box}
   .international-phone-options{min-height:0;max-height:52dvh;overflow-y:auto;overscroll-behavior:contain;display:grid;gap:2px}
   .international-phone-option{display:flex;align-items:center;text-align:left;gap:10px;width:100%;min-height:44px;padding:10px 8px;border:0;border-radius:8px;background:#fff;color:#231b20;cursor:pointer;font:inherit;box-shadow:none}
   .international-phone-option:hover,.international-phone-option:focus-visible,.international-phone-option.selected{background:#f3eaf0}
   .international-phone-name{flex:1;min-width:0;overflow-wrap:anywhere}
   .international-phone-dial{white-space:nowrap;color:#65525c;font-size:14px}
   .international-phone-check{color:#79243f;font-weight:700}
   .international-phone-no-results{padding:12px 4px;margin:0;color:#65525c}
   @media(max-width:480px){.international-phone-dialog{max-height:78dvh}.international-phone-picker{max-height:78dvh;padding:14px}.international-phone-options{max-height:48dvh}}
  `}</style>
 </div>;
}
