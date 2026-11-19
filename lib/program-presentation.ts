import type {ProgramType} from "@/lib/types";

export type PublicProgram={
 type:ProgramType;
 reward_label?:string|null;
 reward_cost?:number|null;
 points_per_euro?:number|null;
 cashback_bps?:number|null;
};

export function programPromise(p?:PublicProgram|null):string{
 if(!p)return "Descubre las recompensas de este negocio";
 const reward=(p.reward_label||"una recompensa especial").trim();
 const cost=Math.max(1,Math.floor(Number(p.reward_cost)||8));
 if(p.type==="stamps")return "Cada "+cost+" sellos, "+reward;
 if(p.type==="points")return "Canjea "+cost+" puntos por "+reward;
 const percentage=Math.max(0,Number(p.cashback_bps)||0)/100;
 return "Recupera el "+new Intl.NumberFormat("es-ES",{maximumFractionDigits:2}).format(percentage)+" % de tus compras como saldo";
}

export function programExplanation(p?:PublicProgram|null):string{
 if(!p)return "Consulta las condiciones al entrar.";
 if(p.type==="stamps")return "Acumula un sello por cada visita o compra válida, según las reglas del negocio. Cuando completes tu tarjeta, podrás pedir tu premio.";
 if(p.type==="points")return "Suma puntos con tus compras y utilízalos cuando alcances los necesarios para la recompensa.";
 return "Una parte de cada compra válida se añade a tu saldo para que puedas disfrutarla en tus próximas visitas.";
}
