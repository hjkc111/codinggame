import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,botActions} from '../lib/game.ts';
import {applyFrame,ReplayCursor} from '../lib/replay.ts';
test('recorded decisions reproduce final state and arbitrary backward/forward seeks',()=>{
  const initial=createWorld(['A','B','C']),world=structuredClone(initial),frames=[];
  for(let i=0;i<900;i++)frames.push(applyFrame(world,Object.assign({},...world.players.map(p=>botActions(world,p.id)))));
  const replay={initial,frames,errors:[],final:world},cursor=new ReplayCursor(replay);
  assert.deepEqual(cursor.seek(180),world);
  for(const seconds of [17.35,0,111.1,5,179.95,180]){
    const fresh=new ReplayCursor(replay);assert.deepEqual(cursor.seek(seconds),fresh.seek(seconds));
  }
  assert.equal(initial.time,0);assert.equal(world.status,'finished');assert.equal(world.tick,3600);
});
