import {env} from 'cloudflare:workers';
import {newRoom, changeRoom, publicRoom, type Room, type Seat} from '@/lib/series';
import {createWorld} from '@/lib/game';
import {applyFrame} from '@/lib/replay';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const digest=async(token:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export async function POST(request:Request){
  try{
    const raw=await request.text();if(raw.length>100000)return json({error:'请求过大'},413);
    const b=JSON.parse(raw);const now=Date.now();const db=env.DB;
    if(!db)return json({error:'房间服务暂时不可用，请稍后重试'},503);
    const name=typeof b.name==='string'?b.name.trim().slice(0,20):'玩家';
    if(b.op==='create'){
      const token=crypto.randomUUID();
      const room=newRoom({id:'p0',name:name||'玩家',hash:await digest(token),seq:-1,seen:now,ready:false},now);
      for(let i=0;i<3;i++){
        const code=crypto.randomUUID().replaceAll('-','').slice(0,6).toUpperCase();
        const result=await db.prepare('INSERT INTO rooms (code, version, payload, updated_at) VALUES (?, 0, ?, ?) ON CONFLICT(code) DO NOTHING').bind(code,JSON.stringify(room),now).run();
        if(result.meta.changes)return json({...publicRoom(code,room,0,now),token,playerId:'p0'});
      }return json({error:'创建房间冲突，请重试'},409);
    }
    const code=String(b.code||'').toUpperCase();if(!/^[A-F0-9]{6}$/.test(code))return json({error:'请输入六位房间码'},400);
    if(!['join','ready','timer','rematch','sync','batch','replay','claim'].includes(b.op))return json({error:'未知操作'},400);
    const newToken=b.op==='join'?crypto.randomUUID():null;
    const tokenHash=await digest(newToken||String(b.token||''));
    for(let attempt=0;attempt<6;attempt++){
      const row=await db.prepare('SELECT version, payload FROM rooms WHERE code = ?').bind(code).first<{version:number;payload:string}>();
      if(!row)return json({error:'房间不存在，请检查房间码'},404);
      const room:Room=JSON.parse(row.payload);if(room.format!==3)return json({error:'房间版本已更新，请创建新房间'},409);if(now-room.created>3600000)return json({error:'房间已过期，请创建新房间'},410);
      let seat:Seat|undefined;
      let canonical:ReturnType<typeof changeRoom>;
      if(b.op==='join'){
        if((room.status!=='waiting'||room.history.length>0))return json({error:'比赛已开始，请等待下一局'},409);
        if(room.seats.length>=4)return json({error:'房间已满，第一版最多四人'},409);
        seat={id:`p${room.seats.length}`,name:name||'玩家',hash:tokenHash,seq:-1,seen:now,ready:false};room.seats.push(seat);room.seats.forEach(s=>s.ready=false);
      }else{
        seat=room.seats.find(s=>s.hash===tokenHash);if(!seat)return json({error:'席位凭证无效，请重新加入'},403);
        if(b.op==='replay'){
          const result=room.history.find(h=>h.round===b.round);
          if(b.match!==room.match||!result)return json({error:'本轮战报尚未生成或场次已变化'},409);
          const chunks=await db.prepare('SELECT payload FROM replay_chunks WHERE code=? AND match_no=? AND round_no=? AND compute_id=? ORDER BY start_step').bind(code,room.match,result.round,result.computeId).all<{payload:string}>();
          const frames=chunks.results.flatMap(c=>JSON.parse(c.payload));
          if(frames.length!==900)return json({error:'战报数据不完整，请稍后重试'},503);
          const initial=createWorld(room.seats.map(s=>s.name),180,result.round-1),final=structuredClone(initial);
          for(const frame of frames)applyFrame(final,frame);
          return json({initial,frames,errors:result.errors,final});
        }
        try{canonical=changeRoom(room,seat,b,now);}catch(e){return json({error:e instanceof Error?e.message:'房间操作失败'},409);}
      }
      const update=db.prepare('UPDATE rooms SET payload = ?, version = version + 1, updated_at = ? WHERE code = ? AND version = ?').bind(JSON.stringify(room),now,code,row.version);
      let changed;
      if(canonical){
        // Both statements share one D1 transaction and the same optimistic revision.
        const results=await db.batch([
          db.prepare('INSERT INTO replay_chunks (code,match_no,round_no,compute_id,start_step,payload) SELECT ?,?,?,?,?,? FROM rooms WHERE code=? AND version=?').bind(code,b.match,b.round,b.computeId,b.start,JSON.stringify(canonical),code,row.version),
          update
        ]);
        changed=results[1].meta.changes;
      }else changed=(await update.run()).meta.changes;
      if(changed)return json({...publicRoom(code,room,row.version+1,now),...(newToken?{token:newToken,playerId:seat.id}:{})});
    }
    return json({error:'房间同步繁忙，正在重试'},409);
  }catch(error){console.error('room request failed',error instanceof Error?error.message:'unknown');return json({error:'房间请求失败，请稍后重试'},500);}
}
