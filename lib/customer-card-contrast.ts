/** Text contrast for the customer's merchant cards; business colors stay intact. */
function parseHex(value:string):[number,number,number]|null{
 const hex=value.trim().replace(/^#/,"");
 if(!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex))return null;
 const full=hex.length===3?hex.split("").map(x=>x+x).join(""):hex;
 return [0,2,4].map(i=>parseInt(full.slice(i,i+2),16)) as [number,number,number];
}
function luminance(rgb:[number,number,number]):number{
 const channels=rgb.map(value=>{
  const srgb=value/255;
  return srgb<=0.04045?srgb/12.92:Math.pow((srgb+0.055)/1.055,2.4);
 });
 return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
}
function ratio(a:[number,number,number],b:[number,number,number]):number{
 const x=luminance(a),y=luminance(b);
 return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}
/** Preserve a merchant's chosen text when readable; correct low-contrast combinations. */
export function readableCardText(background:string|undefined,requested:string|undefined,hasPhoto=false):string{
 // A dark scrim is applied over merchant photos, so light text remains legible.
 if(hasPhoto)return "#FFFFFF";
 const bg=parseHex(background||"")||parseHex("#5E1A2B")!;
 const preferred=parseHex(requested||"");
 if(preferred&&ratio(preferred,bg)>=4.5)return requested!;
 const light=parseHex("#FFFFFF")!,dark=parseHex("#22201F")!;
 return ratio(light,bg)>=ratio(dark,bg)?"#FFFFFF":"#22201F";
}
