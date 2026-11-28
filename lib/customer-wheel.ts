// Continuous, circular wallet geometry, independent of React for regression tests.
export const wheelStep=108;
export function wrapIndex(value:number,count:number){return ((value%count)+count)%count;}
export function wheelSlots(position:number,count:number){
 if(count<=0)return [];
 const center=Math.round(position),span=Math.min(3,count-1);
 const nearest=new Map<number,{slot:number;index:number;offset:number}>();
 for(let slot=center-span;slot<=center+span;slot++){
  const index=wrapIndex(slot,count),offset=slot-position,prior=nearest.get(index);
  if(!prior||Math.abs(offset)<Math.abs(prior.offset))nearest.set(index,{slot,index,offset});
 }
 return [...nearest.values()].sort((a,b)=>a.slot-b.slot);
}
export function wheelTransform(offset:number){
 const distance=Math.abs(offset),angle=Math.min(distance*.55,1.43);
 return {y:Math.sign(offset)*Math.sin(angle)*165,z:(Math.cos(angle)-1)*185,rotate:-Math.sign(offset)*angle*24,scale:1-distance*.065,opacity:Math.max(0,1-Math.max(0,distance-2.25)*1.25),layer:100-Math.round(distance*20)};
}
export function wheelDestination(position:number,velocity:number){
 return Math.round(position+Math.max(-8,Math.min(8,velocity*250)));
}
