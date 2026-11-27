export type MilestoneRule={position:number;label:string};
export type MilestoneGrant={id:string;position:number;label:string;issued_at:string;available:boolean;redeemed:boolean};
export type MilestoneDetails={rules:MilestoneRule[];grants:MilestoneGrant[]};
export const emptyMilestones:MilestoneDetails={rules:[],grants:[]};

/** One marker for each intermediate position; ignore invalid and final stamps. */
export function milestoneAt(rules:readonly MilestoneRule[],position:number,total:number){
 return position>=1&&position<total?rules.find(rule=>rule.position===position):undefined;
}
export function availableMilestonePositions(total:number,rules:readonly {position:number;active:boolean}[]){
 return Array.from({length:Math.max(0,Math.min(29,Math.floor(total)-1))},(_,i)=>i+1).filter(i=>!rules.some(r=>r.active&&r.position===i));
}
