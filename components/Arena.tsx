'use client';
import {useEffect,useRef} from 'react';
import {W,H,type World,dist} from '@/lib/game';
import {displayPosition} from '@/lib/presentation';
export default function Arena({world,selected,onSelect,guides,running,online=false}:{online?:boolean;world:World;selected:string|null;onSelect:(id:string)=>void;guides:boolean;running:boolean}){
  const canvas=useRef<HTMLCanvasElement>(null),latest=useRef(world),settings=useRef({selected,guides,running,online}),receivedAt=useRef(0),positions=useRef(new Map<string,{x:number;y:number}>());
  if(latest.current!==world){latest.current=world;receivedAt.current=performance.now();}settings.current={selected,guides,running,online};
  useEffect(()=>{
    const el=canvas.current!,ctx=el.getContext('2d')!;let frame=0,previous=0;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw=(now:number)=>{
      frame=requestAnimationFrame(draw);if(document.hidden)return;
      const rect=el.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
      if(el.width!==Math.round(rect.width*dpr)||el.height!==Math.round(rect.height*dpr)){el.width=Math.round(rect.width*dpr);el.height=Math.round(rect.height*dpr);}
      ctx.setTransform(el.width/W,0,0,el.height/H,0,0);
      const w=latest.current,s=settings.current,delta=Math.min((now-previous)/1000,.1);previous=now;
      const age=s.running?Math.max(0,Math.min((now-receivedAt.current)/1000,.35)):0;
      const visualTime=w.time+age;
      const t=reduced?0:now/1000;
      ctx.fillStyle='#09191f';ctx.fillRect(0,0,W,H);
      const glow=ctx.createRadialGradient(480,320,20,480,320,500);glow.addColorStop(0,'#15323a');glow.addColorStop(1,'#09191f');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
      ctx.strokeStyle='#23404a55';ctx.lineWidth=1;
      for(let x=0;x<=W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
      for(let y=0;y<=H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
      ctx.strokeStyle='#41606a44';ctx.setLineDash([4,8]);ctx.strokeRect(30,30,W-60,H-60);ctx.setLineDash([]);
      ctx.font='11px monospace';ctx.fillStyle='#54747e';for(let x=80;x<W;x+=160)ctx.fillText(String(x).padStart(3,'0'),x,20);
      // Objective and base geometry encode actual capture/delivery zones.
      ctx.save();ctx.translate(480,320);ctx.rotate(Math.PI/4);ctx.strokeStyle='#a0874855';ctx.lineWidth=2;ctx.strokeRect(-60,-60,120,120);ctx.strokeStyle='#a0874822';ctx.strokeRect(-75,-75,150,150);ctx.restore();
      for(const p of w.players){
        ctx.save();ctx.translate(p.base.x,p.base.y);ctx.fillStyle=p.color+'0c';ctx.strokeStyle=p.color+'55';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,46,0,Math.PI*2);ctx.fill();ctx.stroke();
        ctx.strokeStyle=p.color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,38,t*.15,t*.15+1.8);ctx.stroke();ctx.beginPath();ctx.arc(0,0,38,t*.15+Math.PI,t*.15+Math.PI+1.8);ctx.stroke();
        ctx.fillStyle=p.color;ctx.fillRect(-9,-9,18,18);ctx.fillStyle='#0c2027';ctx.fillRect(-4,-4,8,8);ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillStyle=p.color;ctx.fillText(p.name,0,66);ctx.restore();
      }
      for(const r of w.resources){
        ctx.save();ctx.translate(r.x,r.y);
        if(r.amount<=0){ctx.strokeStyle='#57626c55';ctx.beginPath();ctx.arc(0,0,r.core?15:9,0,Math.PI*2);ctx.stroke();if(r.core){ctx.fillStyle='#c0a767';ctx.font='12px monospace';ctx.textAlign='center';ctx.fillText(`${Math.ceil(r.refill)}s`,0,5);}ctx.restore();continue;}
        const color=r.core?'#ffcf72':'#74d1e0';const size=r.core?17:8;
        ctx.shadowBlur=reduced?0:15+Math.sin(t*2+r.x)*4;ctx.shadowColor=color;ctx.fillStyle=color;ctx.rotate(r.core?t*.35:Math.PI/4);ctx.fillRect(-size/2,-size/2,size,size);ctx.shadowBlur=0;ctx.strokeStyle=color+'66';ctx.strokeRect(-size,-size,size*2,size*2);ctx.restore();
        if(r.core){ctx.font='12px sans-serif';ctx.fillStyle='#e9c77b';ctx.textAlign='center';ctx.fillText('能量核心 · +20',r.x,r.y-35);}
      }
      for(const r of w.robots){
        let p=positions.current.get(r.id);if(!p||dist(p,r)>150||w.time<.1){p={x:r.x,y:r.y};positions.current.set(r.id,p);}
        const predicted=s.online&&s.running?displayPosition(w,r,age):r;
        const mix=reduced||!s.running?1:1-Math.exp(-delta*20);p.x+=(predicted.x-p.x)*mix;p.y+=(predicted.y-p.y)*mix;
        if(!r.alive)continue;
        const player=w.players.find(a=>a.id===r.owner)!;
        const target=r.action.type==='move'?{x:r.action.x!,y:r.action.y!}:r.action.type==='gather'?w.resources.find(a=>a.id===r.action.target_id):w.robots.find(a=>a.id===r.action.target_id);
        if(s.guides&&target){ctx.strokeStyle=player.color+'44';ctx.setLineDash([5,7]);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(target.x,target.y);ctx.stroke();ctx.setLineDash([]);}
        if(s.selected===r.id){ctx.fillStyle=player.color+'09';ctx.strokeStyle=player.color+'33';ctx.beginPath();ctx.arc(p.x,p.y,r.range,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle=player.color;ctx.beginPath();ctx.arc(p.x,p.y,25,0,Math.PI*2);ctx.stroke();}
        ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='#02080b88';ctx.beginPath();ctx.ellipse(0,8,17,9,0,0,Math.PI*2);ctx.fill();
        ctx.rotate(target?Math.atan2(target.y-p.y,target.x-p.x):0);ctx.fillStyle='#18323a';ctx.strokeStyle=player.color;ctx.lineWidth=2;ctx.shadowColor=player.color;ctx.shadowBlur=7;
        ctx.beginPath();if(r.role==='Scout'){ctx.moveTo(14,0);ctx.lineTo(-9,-9);ctx.lineTo(-4,0);ctx.lineTo(-9,9);}else if(r.role==='Guard'){ctx.roundRect(-11,-10,22,20,4);}else{ctx.moveTo(12,0);ctx.lineTo(6,-11);ctx.lineTo(-8,-11);ctx.lineTo(-13,0);ctx.lineTo(-8,11);ctx.lineTo(6,11);}ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;
        ctx.fillStyle=player.color;ctx.fillRect(1,-3,9,6);ctx.restore();
        ctx.fillStyle='#02090c';ctx.fillRect(p.x-15,p.y-24,30,4);ctx.fillStyle=r.hp/r.maxHp<.3?'#ff7e83':player.color;ctx.fillRect(p.x-15,p.y-24,30*r.hp/r.maxHp,4);
        if(r.cargo){ctx.font='11px monospace';ctx.textAlign='center';ctx.fillStyle='#ffe0a0';ctx.fillText(`${r.cargo}`,p.x,p.y+29);}
      }
      for(const e of w.events){const age=visualTime-e.time;if(age>1.3||age<0)continue;ctx.save();ctx.globalAlpha=Math.max(0,1-age/1.3);ctx.strokeStyle=e.color;ctx.fillStyle=e.color;
        if(e.kind==='shot'&&age<.18){ctx.lineWidth=2;ctx.shadowBlur=8;ctx.shadowColor=e.color;ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.tx!,e.ty!);ctx.stroke();}
        if(e.kind==='gather'||e.kind==='spawn'||e.kind==='death'){ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(e.x,e.y,8+age*(e.kind==='death'?50:25),0,Math.PI*2);ctx.stroke();}
        if(e.kind==='score'){ctx.font='bold 16px monospace';ctx.textAlign='center';ctx.fillText(e.text.split(' ').at(-1)!,e.x,e.y-20-age*25);}ctx.restore();
      }
    };frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
  },[]);
  return <canvas ref={canvas} className="arena-canvas" aria-label="实时机器人战场，点击机器人查看详情；下方队伍列表可用键盘选择" onClick={e=>{const rect=e.currentTarget.getBoundingClientRect(),p={x:(e.clientX-rect.left)/rect.width*W,y:(e.clientY-rect.top)/rect.height*H};const nearest=world.robots.filter(r=>r.alive).sort((a,b)=>dist(positions.current.get(a.id)||a,p)-dist(positions.current.get(b.id)||b,p))[0];if(nearest&&dist(positions.current.get(nearest.id)||nearest,p)<35)onSelect(nearest.id);}}/>;
}
