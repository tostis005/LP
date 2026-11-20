import {type StampKind} from "@/lib/stamp-drawings";

/** Cada sector recibe automáticamente un sello propio; no se configura desde el comercio. */
export const BUSINESS_CATEGORIES=[
 {name:"Cafetería",stamp:"cafeteria"},
 {name:"Restaurante",stamp:"restaurante"},
 {name:"Taquería",stamp:"taqueria"},
 {name:"Barbería",stamp:"barberia"},
 {name:"Peluquería",stamp:"peluqueria"},
 {name:"Panadería",stamp:"panaderia"},
 {name:"Heladería y postres",stamp:"heladeria"},
 {name:"Gimnasio",stamp:"gimnasio"},
 {name:"Spa y bienestar",stamp:"spa"},
 {name:"Mascotas",stamp:"mascotas"},
 {name:"Belleza y estética",stamp:"bienestar"},
 {name:"Floristería",stamp:"floristeria"},
 {name:"Librería",stamp:"libreria"},
 {name:"Moda y accesorios",stamp:"comercio"},
 {name:"Salud y bienestar",stamp:"salud"},
 {name:"Tienda",stamp:"tienda"},
 {name:"Otros",stamp:"comercio"}
] as const satisfies ReadonlyArray<{name:string;stamp:StampKind}>;

export function categoryStampKind(category?:string|null):StampKind{
 return BUSINESS_CATEGORIES.find(c=>c.name===category)?.stamp||"comercio";
}
export const PROGRAM_TYPES=[
 {id:"stamps",label:"Sellos",description:"X visitas o compras para un premio"},
 {id:"points",label:"Puntos",description:"Puntos por importe gastado"},
 {id:"cashback",label:"Saldo a favor",description:"Recupera un porcentaje de tus compras"}
] as const;
