// Fixed, portable font stacks. No external font request or arbitrary CSS input.
export const CARD_FONTS=[
 {id:"default",label:"Original de Kreyvi",family:"inherit"},
 {id:"modern",label:"Moderna · sans serif",family:"Arial, Helvetica, sans-serif"},
 {id:"editorial",label:"Editorial · Georgia",family:"Georgia, 'Times New Roman', serif"},
 {id:"classic",label:"Clásica · Times",family:"'Times New Roman', Times, serif"},
 {id:"rounded",label:"Amable · Trebuchet",family:"'Trebuchet MS', Arial, sans-serif"},
 {id:"geometric",label:"Geométrica · Verdana",family:"Verdana, Geneva, sans-serif"},
 {id:"mono",label:"Retro · Monoespaciada",family:"'Courier New', Courier, monospace"},
 {id:"display",label:"Impactante · Display",family:"Impact, 'Arial Narrow', Arial, sans-serif"}
] as const;
export function cardTitleFont(value?:string|null){return CARD_FONTS.find(f=>f.id===value)?.family||"inherit";}
