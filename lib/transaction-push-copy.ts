export type TransactionNotice={program_type:string;currency:string;amount_delta:number;balance:number;reward_cost:number;reward_label:string};
const count=(n:number,one:string,many:string)=>n+" "+(n===1?one:many);
function cash(cents:number,currency:string){
 const code=/^[A-Z]{3}$/.test(currency)?currency:"MXN";
 return new Intl.NumberFormat("es-MX",{style:"currency",currency:code,currencyDisplay:"narrowSymbol",minimumFractionDigits:cents%100===0?0:2,maximumFractionDigits:2}).format(cents/100)+" "+code;
}
export function transactionPushCopy(n:TransactionNotice){
 const stamps=n.program_type==="stamps",points=n.program_type==="points";
 if(!stamps&&!points)return {title:"Cashback recibido",body_text:"Has acumulado "+cash(n.amount_delta,n.currency)+". Tu saldo disponible es de "+cash(n.balance,n.currency)+"."};
 const earned=stamps?count(n.amount_delta,"sello","sellos"):count(n.amount_delta,"punto","puntos");
 const reached=n.reward_cost>0&&n.balance>=n.reward_cost&&n.balance-n.amount_delta<n.reward_cost;
 if(reached)return {title:"¡Premio conseguido! 🎉",body_text:"Has ganado "+earned+". "+(stamps?"Has completado tu tarjeta. ":"")+"Ya puedes disfrutar de tu recompensa: "+n.reward_label+"."};
 if(stamps&&n.reward_cost>0&&n.balance<n.reward_cost){
  const left=n.reward_cost-n.balance;
  return {title:"¡Has ganado "+earned+"!",body_text:"Ya tienes "+n.balance+" de "+n.reward_cost+" sellos. "+(left===1?"¡Solo te falta 1 sello para conseguir tu premio!":"¡Solo te faltan "+left+" para conseguir tu premio!")};
 }
 return {title:"¡Has ganado "+earned+"!",body_text:"Tu nuevo saldo es de "+(stamps?count(n.balance,"sello","sellos"):count(n.balance,"punto","puntos"))+". Sigue acumulando recompensas."};
}
