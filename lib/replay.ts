import {acceptActions, step, type Actions, type World} from './game.ts';
export type Replay = {initial:World; frames:Actions[]; errors:string[]; final:World};
export const TICKS_PER_DECISION=4;
export function applyFrame(world:World,input:unknown):Actions {
  for(const player of world.players)acceptActions(world,player.id,input);
  const actions=Object.fromEntries(world.robots.map(r=>[r.id,{...r.action}]));
  for(let i=0;i<TICKS_PER_DECISION;i++)step(world,.05);
  return actions;
}
export class ReplayCursor {
  world:World;
  private checkpoints=new Map<number,World>();
  replay:Replay;
  constructor(replay:Replay){
    this.replay=replay;
    this.world=structuredClone(replay.initial);this.checkpoints.set(0,structuredClone(this.world));
    for(const frame of replay.frames){applyFrame(this.world,frame);if(this.world.tick%100===0)this.checkpoints.set(this.world.tick,structuredClone(this.world));}
    this.world=structuredClone(replay.initial);
  }
  seek(seconds:number){
    const target=Math.min(this.replay.frames.length*4,Math.max(0,Math.floor((seconds+1e-8)/.05)));
    if(target<this.world.tick||target-this.world.tick>100)this.world=structuredClone(this.checkpoints.get(Math.floor(target/100)*100)!);
    while(this.world.tick<target&&this.world.status==='running'){
      if(this.world.tick%4===0)for(const p of this.world.players)acceptActions(this.world,p.id,this.replay.frames[this.world.tick/4]);
      step(this.world,.05);
    }
    return this.world;
  }
}
