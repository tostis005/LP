import type {Membership} from "@/lib/types";
export function visibleWalletCards<T extends Membership>(cards:readonly T[]):T[]{
 return cards.filter(card=>!card.customer_hidden).sort((a,b)=>Number(!!b.customer_favorite)-Number(!!a.customer_favorite)||b.created_at.localeCompare(a.created_at)||a.id.localeCompare(b.id));
}
