"use client";
import {useEffect,useRef,useState} from "react";
import {Bold,Italic,Link2,List,ListOrdered,Smile,Eye,Edit3} from "lucide-react";
import {safeCampaignHtml} from "@/lib/marketing-rich";

type Props={value:string;onChange:(next:string)=>void;channel:"email"|"whatsapp";placeholder?:string};
const EMOJIS=["❤️","🎉","✨","☕","🍕","🎁","🥳","😊","🔥","⭐","💌","🙌"];
function toMarkdown(root:HTMLElement){
 function walk(node:Node):string{
  if(node.nodeType===Node.TEXT_NODE)return (node.textContent||"").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"");
  if(node.nodeType!==Node.ELEMENT_NODE)return "";
  const el=node as HTMLElement,tag=el.tagName.toLowerCase();
  const child=Array.from(el.childNodes).map(walk).join("");
  if(tag==="br")return "\n";
  if(tag==="strong"||tag==="b")return child.trim()?"**"+child+"**":"";
  if(tag==="i"||tag==="em")return child.trim()?"_"+child+"_":"";
  if(tag==="a"){
   const href=el.getAttribute("href")||"";
   return /^https?:\/\/[^\s"<>]+$/i.test(href)?"["+child+"]("+href+")":child;
  }
  if(tag==="li")return "- "+child.trim()+"\n";
  if(tag==="div"||tag==="p")return child+"\n";
  if(tag==="ul"||tag==="ol")return "\n"+child+"\n";
  return child;
 }
 return Array.from(root.childNodes).map(walk).join("").replace(/\n{3,}/g,"\n\n").trim().slice(0,12000);
}
export function RichMessageEditor({value,onChange,channel,placeholder="Escribe aquí tu mensaje..."}:Props){
 const editor=useRef<HTMLDivElement>(null),lastEmitted=useRef("");
 const [preview,setPreview]=useState(false),[emojis,setEmojis]=useState(false);
 useEffect(()=>{
  if(editor.current&&value!==lastEmitted.current){
   editor.current.innerHTML=safeCampaignHtml(value);
   lastEmitted.current=value;
  }
 },[value]);
 function emit(){if(!editor.current)return;const next=toMarkdown(editor.current);lastEmitted.current=next;onChange(next);}
 function command(type:string,value?:string){editor.current?.focus();document.execCommand(type,false,value);emit();}
 function insertEmoji(emoji:string){command("insertText",emoji);setEmojis(false);}
 function link(){
  const selection=window.getSelection()?.toString().trim()||"";
  if(!selection)return;
  const entered=window.prompt("Enlace a una página segura (https://):","https://");
  if(!entered)return;
  try{const url=new URL(entered);if(!["https:","http:"].includes(url.protocol))return;command("createLink",url.toString());}catch{}
 }
 return <div className="rich-message-field">
  <div className="rich-message-tools" role="toolbar" aria-label="Formato del mensaje">
   <button title="Negrita" aria-label="Negrita" type="button" onClick={()=>command("bold")}><Bold size={17}/></button>
   <button title="Cursiva" aria-label="Cursiva" type="button" onClick={()=>command("italic")}><Italic size={17}/></button>
   <button title="Lista" aria-label="Lista" type="button" onClick={()=>command("insertUnorderedList")}><List size={17}/></button>
   <button title="Lista numerada" aria-label="Lista numerada" type="button" onClick={()=>command("insertOrderedList")}><ListOrdered size={17}/></button>
   <button title="Añadir enlace" aria-label="Añadir enlace" type="button" onClick={link}><Link2 size={17}/></button>
   <button title="Emojis" aria-label="Emojis" type="button" aria-expanded={emojis} onClick={()=>setEmojis(x=>!x)}><Smile size={17}/></button>
   <span className="rich-message-tool-space"/>
   <button title={preview?"Volver a editar":"Vista previa"} aria-label={preview?"Volver a editar":"Vista previa"} type="button" onClick={()=>{emit();setPreview(x=>!x)}}>{preview?<Edit3 size={17}/>:<Eye size={17}/>}</button>
  </div>
  {emojis&&<div className="rich-message-emojis" role="group" aria-label="Añadir emoji">
   {EMOJIS.map(e=><button key={e} title={e} aria-label={"Añadir "+e} type="button" onClick={()=>insertEmoji(e)}>{e}</button>)}
  </div>}
  <div style={{display:preview?"none":"block"}} ref={editor} contentEditable role="textbox" aria-multiline="true"
   aria-label={channel==="email"?"Contenido del correo":"Contenido de WhatsApp"}
   data-placeholder={placeholder} className="rich-message-editor" suppressContentEditableWarning
   onInput={emit} onBlur={emit}
   onPaste={e=>{e.preventDefault();const plain=e.clipboardData.getData("text/plain").slice(0,10000);document.execCommand("insertText",false,plain);emit();}}/>
  {preview&&<div className="rich-message-preview"><div className="rich-message-preview-heading">Vista previa del mensaje</div>
   <div dangerouslySetInnerHTML={{__html:safeCampaignHtml(value)}}/>
  </div>}
  <div className="rich-message-foot"><span>{channel==="whatsapp"?"Los emojis y las negritas se adaptan al formato de WhatsApp. El envío requiere una plantilla aprobada.":"La presentación se adaptará al correo del destinatario."}</span><small>{value.length}/12000</small></div>
 </div>;
}
