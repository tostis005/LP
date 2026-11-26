export type MilestoneRule={position:number;label:string};
export type MilestoneGrant={id:string;position:number;label:string;issued_at:string;available:boolean;redeemed:boolean};
export type MilestoneDetails={rules:MilestoneRule[];grants:MilestoneGrant[]};
export const emptyMilestones:MilestoneDetails={rules:[],grants:[]};
