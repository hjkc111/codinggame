import {createWorld, type World, type Actions} from './game.ts';
import {applyFrame} from './replay.ts';
export type Program={language:'python'|'javascript';code:string};

export type Seat = {id:string; name:string; hash:string; seq:number; seen:number; ready:boolean;program?:Program};
export type RoundResult = {round:number;computeId:string;errors:string[]; players:{id:string; collected:number; delivered:number; deaths:number; points:number; win:number}[]};
export type Room = {format:3; match:number; round:number; status:'waiting'|'computing'|'intermission'|'finished'; seats:Seat[]; world:World|null; history:RoundResult[]; last:number; starts:number; ends:number; prepEnds:number; created:number; computeId:string; executor:string; frames:number; errors:string[]};
export function newRoom(seat:Seat, now:number):Room {
  return {format:3,match:1,round:1,status:'waiting',seats:[seat],world:null,history:[],last:now,starts:0,ends:0,prepEnds:0,created:now,computeId:'',executor:'',frames:0,errors:[]};
}
export function standings(r:Room){
  return r.seats.map(s=>({id:s.id,name:s.name,points:r.history.reduce((n,h)=>n+h.players.find(p=>p.id===s.id)!.points,0),wins:r.history.reduce((n,h)=>n+h.players.find(p=>p.id===s.id)!.win,0),delivered:r.history.reduce((n,h)=>n+h.players.find(p=>p.id===s.id)!.delivered,0)}));
}
export function winners(r:Room){
  const table=standings(r);
  if(r.seats.length===2){const best=Math.max(...table.map(p=>p.wins));return table.filter(p=>p.wins===best).map(p=>p.id);}
  const best=Math.max(...table.map(p=>p.points));const tied=table.filter(p=>p.points===best);const energy=Math.max(...tied.map(p=>p.delivered));return tied.filter(p=>p.delivered===energy).map(p=>p.id);
}
function finishRound(r:Room,now:number){
  const players=r.world!.players;
  r.history.push({round:r.round,computeId:r.computeId,errors:[...r.errors],players:players.map(p=>{
    const better=players.filter(q=>q.score>p.score).length, tied=players.filter(q=>q.score===p.score).length;
    return {id:p.id,collected:p.collected,delivered:p.score,deaths:p.deaths,points:players.length-better-(tied-1)/2,win:better===0&&tied===1?1:0};
  })});
  r.seats.forEach(s=>{s.ready=false;s.seq=-1;});
  const complete=r.round===3||(r.seats.length===2&&standings(r).some(p=>p.wins===2));
  r.status=complete?'finished':'intermission';
  if(!complete){r.round++;r.prepEnds=now+300000;}
}
export function tickRoom(r:Room,now:number){
  if(r.status==='computing'&&now-r.last>60000){
    r.status=r.history.length?'intermission':'waiting';r.computeId='';r.executor='';r.frames=0;r.world=null;
    r.seats.forEach(s=>{s.ready=false;});r.errors=['计算连接中断，请重新提交准备。'];
  }
}
export type Command={op:string;match?:number;round?:number;ready?:boolean;seconds?:number;program?:Program;computeId?:string;executor?:string;start?:number;frames?:unknown[];errors?:string[]};
export function changeRoom(r:Room,seat:Seat,b:Command,now:number):Actions[]|undefined {
  tickRoom(r,now);seat.seen=Math.max(now,seat.seen);
  if(b.op==='sync')return;
  if(b.match!==r.match||b.round!==r.round)throw Error('轮次已变化，请等待同步后重试');
  if(b.op==='ready'){
    if(!['waiting','intermission'].includes(r.status))throw Error('本轮代码已锁定，下一轮再提交');
    if(b.ready){
      if(!b.program||!['python','javascript'].includes(b.program.language)||typeof b.program.code!=='string'||!b.program.code.trim()||b.program.code.length>20000)throw Error('请提交有效程序，最多 20,000 字符');
      seat.program=b.program;
    }
    seat.ready=b.ready===true;
    if(r.seats.length>=2&&r.seats.every(s=>s.ready)){
      r.status='computing';r.computeId=crypto.randomUUID();r.executor='';r.frames=0;r.errors=[];r.last=now;
      r.world=createWorld(r.seats.map(s=>s.name),180,r.round-1);
    }
  }else if(b.op==='claim'){
    if(seat.id!=='p0'||r.status!=='computing'||b.computeId!==r.computeId||typeof b.executor!=='string'||b.executor.length!==36)throw Error('计算任务已失效');
    if(r.executor&&r.executor!==b.executor)throw Error('另一房主页面正在计算；如已关闭，请等待 60 秒后重新提交。');
    r.executor=b.executor;
  }else if(b.op==='batch'){
    if(seat.id!=='p0'||r.status!=='computing'||b.computeId!==r.computeId||!r.executor||b.executor!==r.executor)throw Error('计算任务已失效');
    if(!Number.isSafeInteger(b.start)||b.start!<0)throw Error('无效的批次位置');
    if(b.start!<r.frames)return;
    if(b.start!==r.frames)throw Error('批次顺序错误');
    if(!Array.isArray(b.frames)||b.frames.length<1||b.frames.length>20||r.frames+b.frames.length>900)throw Error('无效的动作批次');
    const canonical=b.frames.map(frame=>applyFrame(r.world!,frame));
    r.frames+=canonical.length;r.last=now;
    if(Array.isArray(b.errors))r.errors=[...new Set([...r.errors,...b.errors.filter(e=>typeof e==='string').map(e=>e.slice(0,1500))])].slice(0,4);
    if(r.world!.status==='finished')finishRound(r,now);
    return canonical;
  }else if(b.op==='timer'){
    if(seat.id!=='p0'||!['waiting','intermission'].includes(r.status))throw Error('只有准备阶段的房主可以设置提醒');
    if(![0,120,600].includes(b.seconds!))throw Error('无效的提醒时间');
    r.prepEnds=b.seconds===0?0:(b.seconds===120?Math.max(now,r.prepEnds):now)+b.seconds!*1000;
  }else if(b.op==='rematch'){
    if(seat.id!=='p0'||r.status!=='finished')throw Error('整场结束后由房主再开一场');
    r.match++;r.round=1;r.status='waiting';r.history=[];r.world=null;r.prepEnds=0;r.last=now;r.computeId='';r.executor='';r.frames=0;r.errors=[];
    r.seats.forEach(s=>{s.ready=false;s.seq=-1;});
  }else throw Error('未知操作');
}
export function publicRoom(code:string,r:Room,revision:number,now:number){return {code,match:r.match,round:r.round,status:r.status,players:r.seats.map(s=>({id:s.id,name:s.name,ready:s.ready,program:r.status==='computing'?s.program:undefined})),history:r.history,standings:standings(r),winners:r.status==='finished'?winners(r):[],prepEnds:r.prepEnds,serverNow:now,revision,computeId:r.computeId,executor:r.executor,frames:r.frames,errors:r.errors};}
