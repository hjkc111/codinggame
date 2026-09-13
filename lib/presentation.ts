import {dist, type Robot, type World} from './game.ts';

// Display-only prediction. Never mutates authoritative combat, health or scores.
// Stop after 350ms without a snapshot rather than inventing a disconnected match.
export function displayPosition(w:World,r:Robot,age:number){
  const a=r.action;
  const target=a.type==='move'?{x:a.x!,y:a.y!}:a.type==='gather'?w.resources.find(t=>t.id===a.target_id&&t.amount>0):a.type==='attack'?w.robots.find(t=>t.id===a.target_id&&t.alive):undefined;
  if(!r.alive||!target||w.status!=='running')return {x:r.x,y:r.y};
  const stop=a.type==='gather'?17:a.type==='attack'?r.range*.85:0,d=dist(r,target);
  if(d<=stop)return {x:r.x,y:r.y};
  const elapsed=Math.max(0,Math.min(age,.35,w.duration-w.time));
  const length=Math.min(d-stop,r.speed*(1-.18*r.cargoSlots/r.capacity)*elapsed);
  return {x:r.x+(target.x-r.x)/d*length,y:r.y+(target.y-r.y)/d*length};
}
export function syncDelay(elapsed:number,running:boolean,failed=false){
  return failed?1000:Math.max(30,(running?150:600)-elapsed);
}
