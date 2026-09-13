import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,acceptActions,advance,botActions,observe,step} from '../lib/game.ts';
test('ownership and finite coordinates are enforced',()=>{
 const w=createWorld();assert.equal(acceptActions(w,'p0',{'p1-0':{type:'move',x:500,y:400},'p0-0':{type:'move',x:NaN,y:0}}),0);assert.equal(w.robots[3].action.type,'idle');
 assert.equal(acceptActions(w,'p0',{'p0-0':{type:'move',x:-100,y:900}}),1);assert.deepEqual(w.robots[0].action,{type:'move',x:18,y:622});
});
test('resources require delivery; dead robots do not harvest',()=>{
 const w=createWorld();const r=w.robots[0],t=w.resources[0];r.x=t.x;r.y=t.y;acceptActions(w,'p0',{[r.id]:{type:'gather',target_id:t.id}});step(w,.05);assert.equal(r.cargo,1);assert.equal(w.players[0].score,0);
 r.x=w.players[0].base.x;r.y=w.players[0].base.y;r.action={type:'idle'};step(w,.05);assert.equal(w.players[0].score,1);assert.equal(r.cargo,0);
 r.alive=false;r.respawn=6;r.x=t.x;r.y=t.y;r.action={type:'gather',target_id:t.id};const remaining=t.amount;step(w,.05);assert.equal(t.amount,remaining);
});
test('same state and actions are deterministic and full matches finish',()=>{
 const a=createWorld(['A','B','C'],15),b=structuredClone(a);
 for(let i=0;i<75;i++){for(const w of [a,b]){for(const p of w.players)acceptActions(w,p.id,botActions(w,p.id));advance(w,.2);}}
 assert.deepEqual(a,b);assert.equal(a.status,'finished');assert(a.players.some(p=>p.score>0));assert(a.events.length<=60);
 const snapshot=structuredClone(a);advance(a,2);assert.deepEqual(a,snapshot);
});
test('simultaneous damage supports mutual destruction',()=>{
 const w=createWorld();const a=w.robots[0],b=w.robots[3];a.x=450;a.y=300;b.x=460;b.y=300;a.hp=b.hp=1;a.action={type:'attack',target_id:b.id};b.action={type:'attack',target_id:a.id};step(w,.05);assert(!a.alive&&!b.alive);
});
test('observation excludes owned units from enemies',()=>{const w=createWorld(['A','B','C','D']);const o=observe(w,'p2');assert.equal(o.robots.length,3);assert.equal(o.enemies.length,9);assert(o.enemies.every(r=>r.owner!=='p2'));});
