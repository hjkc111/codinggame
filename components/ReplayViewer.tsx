'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Arena from './Arena';
import {createWorld,acceptActions,step} from '@/lib/game';
import {ReplayCursor,type Replay} from '@/lib/replay';
export default function ReplayViewer({replay,open,onClose,title}:{replay:Replay|null;open:boolean;onClose:()=>void;title:string}){
  const dialog=useRef<HTMLDialogElement>(null);
  const cursor=useMemo(()=>replay?new ReplayCursor(replay):null,[replay]);
  const [position,setPosition]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[selected,setSelected]=useState<string|null>('p0-0'),[guides,setGuides]=useState(true);
  const time=useRef(0);
  useEffect(()=>{time.current=0;setPosition(0);setPlaying(!!replay);},[replay]);
  useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();if(!open)dialog.current?.close();},[open]);
  useEffect(()=>{
    if(!playing||!cursor||!open)return;
    let frame=0,last=performance.now();
    const tick=(now:number)=>{
      time.current=Math.min(cursor.replay.final.duration,time.current+Math.min((now-last)/1000,.1)*speed);last=now;
      setPosition(time.current);
      if(time.current>=cursor.replay.final.duration){setPlaying(false);return;}
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[playing,cursor,open,speed]);
  const world=cursor?structuredClone(cursor.seek(position)):createWorld();
  // Interpolate between two recorded physics states, even at 0.25x; never predict over the network.
  const displayWorld=structuredClone(world);
  if(replay&&world.status==='running'){
    const next=structuredClone(world),fraction=Math.max(0,Math.min(1,(position-world.time)/.05));
    if(next.tick%4===0)for(const p of next.players)acceptActions(next,p.id,replay.frames[next.tick/4]);
    step(next,.05);
    displayWorld.robots.forEach((r,i)=>{const n=next.robots[i];if(r.alive===n.alive&&Math.hypot(r.x-n.x,r.y-n.y)<30){r.x+=(n.x-r.x)*fraction;r.y+=(n.y-r.y)*fraction;}});
  }
  const focused=world.robots.find(r=>r.id===selected);
  function seek(value:number){time.current=value;setPosition(value);}
  return <dialog ref={dialog} className="battle-dialog" onCancel={onClose} onClose={onClose} aria-label="战场播放器">
    <header className="player-header"><div><span className="eyebrow">LOCAL REPLAY / 独立播放</span><h2>{title}</h2></div><button className="secondary" onClick={onClose}>关闭战场</button></header>
    <div className="player-layout"><div className="panel">
      <div className="scoreboard">{world.players.map(p=><div key={p.id} className="score-item" style={{color:p.color}}>{p.name}<strong>{p.score}</strong><small>EP</small></div>)}</div>
      <Arena key={replay?.initial.players.map(p=>p.name).join()||'preview'} world={displayWorld} selected={selected} onSelect={setSelected} guides={guides} running={playing&&open}/>
      <div className="playback-controls"><button className="secondary" disabled={!replay} onClick={()=>{if(position>=180)seek(0);setPlaying(v=>!v);}}>{playing?'暂停':'播放'}</button><button className="plain-button" disabled={!replay} onClick={()=>{seek(0);setPlaying(true);}}>重新播放</button><label>速度 <select aria-label="播放速度" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[.25,.5,1,2,4].map(v=><option key={v} value={v}>{v}×</option>)}</select></label><output data-testid="playback-time">{position.toFixed(1)} / 180 秒</output></div>
      <input className="replay-range" aria-label="播放进度" type="range" min="0" max="180" step="0.05" value={position} disabled={!replay} onChange={e=>seek(Number(e.target.value))}/>
    </div><aside className="player-inspector"><h3>机器人观察</h3><p className="muted">点击地图或下方机器人，查看当前动作。关闭窗口会暂停，重新打开接着看。</p><div className="robot-list">{world.robots.map(r=><button key={r.id} className={selected===r.id?'selected':''} onClick={()=>setSelected(r.id)} style={{borderLeftColor:world.players.find(p=>p.id===r.owner)!.color}}>{r.id} · {r.role}<small>{r.alive?`${Math.round(r.hp)} HP · ${r.cargo} EP`:'重生中'}</small></button>)}</div>
      {focused&&<pre className="reference-code">{JSON.stringify({id:focused.id,x:Math.round(focused.x),y:Math.round(focused.y),cargoSlots:focused.cargoSlots,capacity:focused.capacity,action:focused.action},null,2)}</pre>}
      <label><input type="checkbox" checked={guides} onChange={e=>setGuides(e.target.checked)}/> 显示行动目标线</label>
      {!replay&&<p>当前是地图预览。运行训练或等待联机计算完成后即可播放。</p>}
      {!!replay?.errors.length&&<pre className="notice">{replay.errors.join('\n')}</pre>}
    </aside></div>
  </dialog>;
}
