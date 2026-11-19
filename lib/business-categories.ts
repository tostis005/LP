import {DEFAULT_STAMP,type StampKind} from "@/lib/stamp-drawings";

/** Cada sector recibe automáticamente un sello propio; no se configura desde el comercio. */
export const BUSINESS_CATEGORIES=[
 {name:"Cafetería",stamp:"coffee"},
 {name:"Restaurante",stamp:"burger"},
 {name:"Taquería",stamp:"taco"},
 {name:"Barbería",stamp:"beard"},
 {name:"Peluquería",stamp:"hair"},
 {name:"Panadería",stamp:"bread"},
 {name:"Heladería y postres",stamp:"icecream"},
 {name:"Gimnasio",stamp:"gym"},
 {name:"Spa y bienestar",stamp:"spa"},
 {name:"Mascotas",stamp:"pet"},
 {name:"Belleza y estética",stamp:"nails"},
 {name:"Floristería",stamp:"flower"},
 {name:"Librería",stamp:"book"},
 {name:"Moda y accesorios",stamp:"star"},
 {name:"Salud y bienestar",stamp:"heart"},
 {name:"Tienda",stamp:"gift"},
 {name:"Otros",stamp:"star"}
] as const satisfies ReadonlyArray<{name:string;stamp:StampKind}>;

export function categoryStampKind(category?:string|null):StampKind{
 return BUSINESS_CATEGORIES.find(c=>c.name===category)?.stamp||DEFAULT_STAMP;
}
export const PROGRAM_TYPES=[
 {id:"stamps",label:"Sellos",description:"X visitas o compras para un premio"},
 {id:"points",label:"Puntos",description:"Puntos por importe gastado"},
 {id:"cashback",label:"Saldo a favor",description:"Recupera un porcentaje de tus compras"}
] as const;
