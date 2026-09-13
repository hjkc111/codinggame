import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorld} from '../lib/game.ts';
import {displayPosition,syncDelay} from '../lib/presentation.ts';
test('movement advances between snapshots without changing authoritative state',()=>{
 const w=createWorld(),r=w.robots[0];r.action={type:'move',x:700,y:r.y};const before=structuredClone(w);
 const a=displayPosition(w,r,.1),b=displayPosition(w,r,.2);assert(a.x>r.x&&b.x>a.x);assert.deepEqual(w,before);
 assert.deepEqual(displayPosition(w,r,5),displayPosition(w,r,.35));
});
test('display prediction respects destinations, gathering range, death and round end',()=>{
 const w=createWorld(),r=w.robots[0];r.action={type:'move',x:r.x+1,y:r.y};assert.equal(displayPosition(w,r,.35).x,r.x+1);
 const t=w.resources[0];r.x=t.x-18;r.y=t.y;r.action={type:'gather',target_id:t.id};assert.equal(displayPosition(w,r,.35).x,t.x-17);
 r.alive=false;assert.equal(displayPosition(w,r,.35).x,r.x);r.alive=true;w.status='finished';assert.equal(displayPosition(w,r,.35).x,r.x);
});
test('sync pacing subtracts RTT, stays serial, and backs off on failure',()=>{
 assert.equal(syncDelay(90,true),60);assert.equal(syncDelay(250,true),30);assert.equal(syncDelay(90,false),510);assert.equal(syncDelay(90,true,true),1000);
});
