import {Runner} from './runner';
import {observe,botActions,type World,type Actions} from './game';
import {applyFrame} from './replay';
import type {Program} from './series';
export class Computation {
  runners=new Map<string,Runner>();
  memories:Record<string,unknown>={};
  errors:string[]=[];
  closed=false;
  constructor(public world:World,public programs:Record<string,Program|null>){}
  async load(){
    await Promise.all(Object.entries(this.programs).map(async([id,program])=>{
      if(!program)return;
      const r=new Runner(program.language);this.runners.set(id,r);this.memories[id]={};
      try{await r.request('load',{},45000);await r.request('compile',{code:program.code});}catch(e){this.fail(id,e);}
    }));
  }
  fail(id:string,error:unknown){this.runners.get(id)?.close();this.errors.push(`${this.world.players.find(p=>p.id===id)?.name}: ${String(error).slice(0,1400)}`);}
  async batch(count=20){
    const frames:Actions[]=[];
    for(let i=0;i<count&&this.world.status==='running';i++){
      if(this.closed)throw Error('计算已取消');
      const actions:Actions={};
      await Promise.all(this.world.players.map(async p=>{
        const r=this.runners.get(p.id);
        if(!this.programs[p.id]){Object.assign(actions,botActions(this.world,p.id));return;}
        if(r&&!r.closed){
          try{
            const result=await r.request('decide',{observation:observe(this.world,p.id),memory:this.memories[p.id]});
            validateDecision(result);this.memories[p.id]=result.memory;
            // Never accept another program's keys, including on the coordinating client.
            for(const robot of this.world.robots.filter(r=>r.owner===p.id))if(result.actions[robot.id])actions[robot.id]=result.actions[robot.id];
            return;
          }catch(e){this.fail(p.id,e);}
        }
        for(const robot of this.world.robots.filter(r=>r.owner===p.id))actions[robot.id]={type:'idle'};
      }));
      frames.push(applyFrame(this.world,actions));
    }
    return frames;
  }
  close(){this.closed=true;for(const r of this.runners.values())r.close();}
}
export function validateDecision(result:{actions:unknown;memory:unknown}){
  if(!result.actions||typeof result.actions!=='object'||Array.isArray(result.actions))throw Error('actions 必须是机器人 ID 到动作的字典');
  if(!result.memory||typeof result.memory!=='object'||Array.isArray(result.memory))throw Error('memory 必须是字典');
  if(JSON.stringify(result.memory).length>65536)throw Error('memory 超过 64 KB');
}
