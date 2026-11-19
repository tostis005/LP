/** Categorías iniciales configurables para el directorio de Loyally. */
export const BUSINESS_CATEGORIES=[
 {name:"Cafetería",icon:"☕"},
 {name:"Restaurante",icon:"🍽️"},
 {name:"Taquería",icon:"🌮"},
 {name:"Barbería",icon:"🧔"},
 {name:"Peluquería",icon:"✂️"},
 {name:"Panadería",icon:"🥐"},
 {name:"Heladería y postres",icon:"🍦"},
 {name:"Gimnasio",icon:"🏋️"},
 {name:"Spa y bienestar",icon:"🌸"},
 {name:"Mascotas",icon:"🐾"},
 {name:"Belleza y estética",icon:"💅"},
 {name:"Floristería",icon:"💐"},
 {name:"Librería",icon:"📚"},
 {name:"Moda y accesorios",icon:"🛍️"},
 {name:"Salud y bienestar",icon:"💚"},
 {name:"Tienda",icon:"🛒"},
 {name:"Otros",icon:"📍"}
] as const;
export function categoryIcon(category?:string|null):string {
 return BUSINESS_CATEGORIES.find(x=>x.name===category)?.icon||"📍";
}
export const PROGRAM_TYPES=[
 {id:"stamps",label:"Sellos",description:"X visitas o compras para un premio"},
 {id:"points",label:"Puntos",description:"Puntos por importe gastado"},
 {id:"cashback",label:"Cashback",description:"Un porcentaje de la compra vuelve a tu saldo"}
] as const;
