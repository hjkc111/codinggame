export type Action = {type: 'move' | 'gather' | 'attack' | 'idle'; x?: number; y?: number; target_id?: string};
export type Actions = Record<string, Action>;
export type Robot = {id: string; owner: string; role: string; x: number; y: number; hp: number; maxHp: number; cargo: number; capacity: number; alive: boolean; speed: number; range: number; damage: number; cooldown: number; respawn: number; harvest: number; action: Action};
export type Resource = {id: string; x: number; y: number; amount: number; value: number; refill: number; core?: boolean};
export type Player = {id: string; name: string; color: string; score: number; base: {x: number; y: number}};
export type GameEvent = {id: number; time: number; kind: string; text: string; x: number; y: number; color: string; tx?: number; ty?: number};
export type World = {time: number; tick: number; duration: number; status: 'running' | 'finished'; players: Player[]; robots: Robot[]; resources: Resource[]; events: GameEvent[]; nextEvent: number};
export const W = 960, H = 640;
export const COLORS = ['#54e5bb', '#ff7e83', '#f2c66f', '#aa9cff'];
export const dist = (a: {x:number;y:number}, b: {x:number;y:number}) => Math.hypot(a.x-b.x,a.y-b.y);
export function createWorld(names = ['你的小队', '巡游者'], duration = 180): World {
  const bases = names.length === 2 ? [{x:95,y:320},{x:865,y:320}] : [{x:95,y:105},{x:865,y:535},{x:865,y:105},{x:95,y:535}];
  const players = names.map((name,i)=>({id:`p${i}`,name,color:COLORS[i],score:0,base:bases[i]}));
  const roles = [{role:'Scout',hp:70,speed:115,capacity:5,damage:7,range:86},{role:'Guard',hp:150,speed:66,capacity:8,damage:17,range:110},{role:'Hauler',hp:100,speed:82,capacity:16,damage:5,range:70}];
  const robots = players.flatMap(p=>roles.map((r,i)=>({id:`${p.id}-${i}`,owner:p.id,role:r.role,x:p.base.x+(i-1)*22,y:p.base.y+24,hp:r.hp,maxHp:r.hp,cargo:0,capacity:r.capacity,alive:true,speed:r.speed,range:r.range,damage:r.damage,cooldown:0,respawn:0,harvest:0,action:{type:'idle'} as Action})));
  const resources: Resource[] = [[240,180],[240,320],[240,460],[720,180],[720,320],[720,460],[380,135],[580,135],[380,505],[580,505],[405,270],[555,370]].map(([x,y],i)=>({id:`r${i}`,x,y,amount:24,value:1,refill:0}));
  resources.push({id:'core',x:480,y:320,amount:1,value:20,core:true,refill:0});
  return {time:0,tick:0,duration,status:'running',players,robots,resources,events:[],nextEvent:0};
}
function event(w:World,kind:string,text:string,x:number,y:number,color:string,extra:Partial<GameEvent>={}) {
  w.events.push({id:++w.nextEvent,time:w.time,kind,text,x,y,color,...extra});
  if(w.events.length>60) w.events.splice(0,w.events.length-60);
}
export function acceptActions(w:World,owner:string,input:unknown):number {
  if(!input || typeof input!=='object' || Array.isArray(input)) return 0;
  let count=0;
  for(const r of w.robots.filter(r=>r.owner===owner)) {
    const a=(input as Record<string,unknown>)[r.id] as Action|undefined;
    if(!a || typeof a!=='object') continue;
    if(a.type==='idle') {r.action={type:'idle'};count++;}
    else if(a.type==='move' && typeof a.x==='number' && typeof a.y==='number' && Number.isFinite(a.x)&&Number.isFinite(a.y)) {
      r.action={type:'move',x:Math.max(18,Math.min(W-18,a.x)),y:Math.max(18,Math.min(H-18,a.y))};count++;
    } else if((a.type==='gather'||a.type==='attack')&&typeof a.target_id==='string'&&a.target_id.length<50) {
      r.action={type:a.type,target_id:a.target_id};count++;
    }
  }
  return count;
}
function move(r:Robot,target:{x:number;y:number},dt:number,stop=0) {
  const d=dist(r,target); if(d<=stop)return;
  const length=Math.min(d-stop,r.speed*(1-.18*r.cargo/r.capacity)*dt);
  r.x+=(target.x-r.x)/d*length;r.y+=(target.y-r.y)/d*length;
}
export function step(w:World,dt:number) {
  if(w.status!=='running'||dt<=0)return;
  dt=Math.min(dt,.05,w.duration-w.time);w.time+=dt;w.tick++;
  for(const resource of w.resources) {
    if(resource.amount===0){resource.refill-=dt;if(resource.refill<=0){resource.amount=resource.core?1:24;if(resource.core)event(w,'core','中央核心已刷新',480,320,'#f2c66f');}}
  }
  const hits:{r:Robot;damage:number}[]=[];
  // Rotate scarce-resource precedence by simulation tick; never permanently favor a player ID.
  const offset=w.tick%w.robots.length;
  const order=[...w.robots.slice(offset),...w.robots.slice(0,offset)];
  for(const r of order){
    const p=w.players.find(p=>p.id===r.owner)!;
    if(!r.alive){r.respawn-=dt;if(r.respawn<=0){r.alive=true;r.hp=r.maxHp;r.x=p.base.x;r.y=p.base.y;r.action={type:'idle'};event(w,'spawn',`${p.name} · ${r.role} 重返战场`,r.x,r.y,p.color);}continue;}
    r.cooldown=Math.max(0,r.cooldown-dt);r.harvest=Math.max(0,r.harvest-dt);
    const a=r.action;
    if(a.type==='move')move(r,{x:a.x!,y:a.y!},dt);
    if(a.type==='gather'){
      const t=w.resources.find(t=>t.id===a.target_id && t.amount>0);
      if(!t){r.action={type:'idle'};continue;}
      move(r,t,dt,17);
      if(dist(r,t)<22&&r.cargo<r.capacity&&r.harvest===0){
        r.cargo+=t.value;t.amount--;r.harvest=.4;
        event(w,'gather',`${r.role} 采集 ${t.core?'核心':'能源'}`,t.x,t.y,p.color);
        if(t.amount===0)t.refill=t.core?35:14;
      }
    }
    if(a.type==='attack'){
      const t=w.robots.find(t=>t.id===a.target_id&&t.alive&&t.owner!==r.owner);
      if(!t)r.action={type:'idle'};
      else {move(r,t,dt,r.range*.85);if(dist(r,t)<=r.range&&r.cooldown===0){hits.push({r:t,damage:r.damage});r.cooldown=.75;event(w,'shot',`${r.role} 攻击`,r.x,r.y,p.color,{tx:t.x,ty:t.y});}}
    }
    if(dist(r,p.base)<43){
      r.hp=Math.min(r.maxHp,r.hp+dt*15);
      if(r.cargo){p.score+=r.cargo;event(w,'score',`${p.name} +${r.cargo}`,r.x,r.y,p.color);r.cargo=0;}
    }
  }
  for(const h of hits)h.r.hp-=h.damage;
  for(const r of w.robots){if(r.alive&&r.hp<=0){r.alive=false;r.hp=0;r.respawn=6;event(w,'death',`${r.role} 被击毁 · 6 秒后重生`,r.x,r.y,w.players.find(p=>p.id===r.owner)!.color);if(r.cargo){const nearest=[...w.resources].filter(t=>!t.core).sort((a,b)=>dist(a,r)-dist(b,r))[0];nearest.amount+=r.cargo;}r.cargo=0;}}
  if(w.time>=w.duration-1e-6){w.time=w.duration;w.status='finished';event(w,'end','比赛结束',480,320,'#f2c66f');}
}
export function advance(w:World,seconds:number){for(let remain=Math.min(seconds,4);remain>1e-7;remain-=.05)step(w,Math.min(.05,remain));}
export function observe(w:World,owner:string){return {tick:w.tick,time:w.time,base:w.players.find(p=>p.id===owner)!.base,robots:w.robots.filter(r=>r.owner===owner),enemies:w.robots.filter(r=>r.owner!==owner&&r.alive),resources:w.resources.filter(r=>r.amount>0),scores:w.players.map(p=>({id:p.id,name:p.name,score:p.score}))};}
export function botActions(w:World,owner:string):Actions {
  const o=observe(w,owner), actions:Actions={};
  o.robots.forEach((r,i)=>{
    if(!r.alive)return;
    const enemy=[...o.enemies].sort((a,b)=>dist(r,a)-dist(r,b))[0];
    if(r.hp<r.maxHp*.3||r.cargo>=r.capacity)actions[r.id]={type:'move',...o.base};
    else if(r.role==='Guard'&&enemy&&dist(r,enemy)<140)actions[r.id]={type:'attack',target_id:enemy.id};
    else {const options=[...o.resources].sort((a,b)=>(dist(r,a)/(a.core?2:1))-(dist(r,b)/(b.core?2:1)));const t=options[Math.min(i===2?1:0,options.length-1)];actions[r.id]=t?{type:'gather',target_id:t.id}:{type:'move',...o.base};}
  });return actions;
}
