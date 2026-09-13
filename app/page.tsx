'use client';
import {useEffect,useRef,useState} from 'react';
import {Braces,BookOpen,Play,Users,Download,Upload} from 'lucide-react';
import ReplayViewer from '@/components/ReplayViewer';
import SeriesPanel from '@/components/SeriesPanel';
import {PYTHON,JAVASCRIPT} from '@/lib/templates';
import {createWorld,observe} from '@/lib/game';
import {Computation,validateDecision} from '@/lib/compute';
import {Runner} from '@/lib/runner';
import type {Replay} from '@/lib/replay';
import type {RoomView} from '@/lib/room-view';
import type {Program} from '@/lib/series';
type Session={code:string;token:string;playerId:string};
async function api<T=RoomView & Session>(body:object){
  const response=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  const data=await response.json() as T & {error?:string};if(!response.ok)throw Error(data.error||'连接失败');return data;
}
const chapters=[
  ['从训练开始','无需完成教程。页面上方是系统只读接口，下方是你的程序。首次打开使用分机器人示例，点击“运行训练”，浏览器会真正执行 Python 并计算 180 秒对局，然后弹出战场。首次下载解释器需要一些时间。修改代码后重新运行，对比交付得分。'],
  ['单独控制机器人','scout、guard、hauler 分别控制三台机器人，每个函数都返回一个动作。robot 是当前机器人的状态，world 是本次观察，memory 是这台机器人的独立字典。使用 robot.move_to(x, y) 前往目标，robot.follow([(x,y),...], memory) 沿路线循环。将 loop=False 可走到末点停止。为不同路线传入不同 key，避免共用进度。'],
  ['字段与目标选择','地图左上角 (0,0)，右下角 (960,640)，无障碍、无战争迷雾。world.resources 是可采资源，world.enemies 是存活敌人；可能为空。nearest_resource / nearest_enemy 找不到时返回 None（JS 为 undefined）。每次决策重新查看状态，不要长期保存失效目标。基地半径 43 内自动卸货、每秒恢复 15 HP。普通能源 1 EP/格，中央核心 20 EP/格；cargoSlots 是格数，cargo 是能量值。'],
  ['联机与提交','创建房间，将网址与六位房间码发给朋友，支持 2–4 人。各自写好代码并“验证并提交”，准备不限时；全部提交后锁定本轮代码。为了统一计算，源码会交给房主浏览器执行，房间成员可见，勿放密钥。房主计算期间保持页面开启。完成后每人下载同一战报，可以自由暂停、拖动和调速，观看期间修改的是下一轮草稿。'],
  ['赛程与结果','两人三局两胜，先胜两局结束，最多三局；单轮平局不计胜场。三到四人固定三轮积分赛，同名次平分对应名次积分，总积分相同再比累计交付。每轮轮换出生点，保留代码、清空 memory。完成计算就结算成绩；各自看完后再次提交进入下一轮，观看速度不影响排名。上一轮战报可从房间按钮重新打开。'],
  ['错误与兼容','每 0.2 秒模拟时间调用策略一次，物理步长 0.05 秒。单次执行约 1.2 秒超时就终止 Worker；计算中出错，该队之后空闲，其他队继续，错误写进战报。memory 只存 JSON 数据，最多 64 KB；代码最多 20,000 字符。旧 decide(observation, memory) 仍有效，Python 返回 actions, memory，JS 返回 [actions, memory]，并优先于三角色入口。错误中的 strategy.py 行号对应编辑器真实逻辑行。草稿仅保存在本机，可下载备份。'],
  ['播放与连接恢复','战场用浏览器动画帧绘制，逻辑与屏幕帧率分开。暂停、0.25–4× 和进度拖动只控制本地回放，不重跑代码。关闭窗口暂停，重新打开接着播放。计算完成后刷新可恢复席位、重新下载战报。计算中房主关闭页面导致 60 秒无进度，会退回准备阶段；重新提交即可。房间创建后有效一小时。当前是浏览器协调的休闲对战，不是严格防作弊排位。'],
];
export default function Home(){
  const [language,setLanguage]=useState<Program['language']>('python'),[code,setCode]=useState(PYTHON),[font,setFont]=useState(16),[caret,setCaret]=useState('1:1');
  const drafts=useRef({python:PYTHON,javascript:JAVASCRIPT}),hydrated=useRef(false),editor=useRef<HTMLTextAreaElement>(null);
  const [sdk,setSdk]=useState(''),[manual,setManual]=useState(false),[roomModal,setRoomModal]=useState(false),[chapter,setChapter]=useState(0);
  const manualDialog=useRef<HTMLDialogElement>(null),roomDialog=useRef<HTMLDialogElement>(null);
  const [replay,setReplay]=useState<Replay|null>(null),[battle,setBattle]=useState(false),[replayTitle,setReplayTitle]=useState('战场预览');
  const [session,setSession]=useState<Session|null>(null),sessionRef=useRef<Session|null>(null),[room,setRoom]=useState<RoomView|null>(null),roomRef=useRef<RoomView|null>(null);
  const [name,setName]=useState('指挥官'),[joinCode,setJoinCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('写好策略，运行一场训练。'),[progress,setProgress]=useState<number|null>(null);
  const work=useRef<Computation|null>(null),validation=useRef<Runner|null>(null),generation=useRef(0),computing=useRef(''),loadedReplay=useRef('');
  useEffect(()=>{
    try{const saved=JSON.parse(localStorage.getItem('codefront-drafts')||'null');if(typeof saved?.python==='string'&&typeof saved?.javascript==='string'){drafts.current=saved;setCode(saved.python);}const seat=JSON.parse(sessionStorage.getItem('codefront-seat')||'null');if(seat?.token&&seat?.code){sessionRef.current=seat;setSession(seat);}}catch{}
    hydrated.current=true;return()=>{work.current?.close();validation.current?.close();};
  },[]);
  useEffect(()=>{if(hydrated.current){drafts.current[language]=code;try{localStorage.setItem('codefront-drafts',JSON.stringify(drafts.current));}catch{}}},[code,language]);
  useEffect(()=>{let active=true;fetch(language==='python'?'/sdk.py':'/sdk.js').then(r=>{if(!r.ok)throw Error();return r.text();}).then(t=>{if(active)setSdk(t);}).catch(()=>{if(active)setSdk('接口源码加载失败，请刷新重试。');});return()=>{active=false;};},[language]);
  useEffect(()=>{if(manual)manualDialog.current?.showModal();else manualDialog.current?.close();},[manual]);
  useEffect(()=>{if(roomModal)roomDialog.current?.showModal();else roomDialog.current?.close();},[roomModal]);
  function applyRoom(view:RoomView){if(view.code!==sessionRef.current?.code||(roomRef.current&&view.revision<roomRef.current.revision))return;roomRef.current=view;setRoom(view);}
  useEffect(()=>{
    if(!session)return;let cancelled=false,timer:ReturnType<typeof setTimeout>;
    const sync=async()=>{try{const view=await api({op:'sync',...session});if(!cancelled)applyRoom(view);}catch(e){if(!cancelled)setError(String(e));}if(!cancelled)timer=setTimeout(sync,1000);};
    sync();return()=>{cancelled=true;clearTimeout(timer);};
  },[session]);
  async function roomAction(op:string,extra:object={}){
    const s=sessionRef.current,r=roomRef.current;if(!s||!r)return;
    try{const view=await api({op,...s,match:r.match,round:r.round,...extra});if(s===sessionRef.current)applyRoom(view);return true;}catch(e){setError(String(e));return false;}
  }
  async function openReplay(round:number,match=roomRef.current?.match){
    const seat=sessionRef.current;if(!seat)return;
    try{const result=await api<Replay>({op:'replay',...seat,match,round});if(seat!==sessionRef.current||roomRef.current?.match!==match)return;setReplay(result);setReplayTitle(`联机 · 第 ${round} 轮战报`);setBattle(true);}catch(e){setError(String(e));}
  }
  useEffect(()=>{
    if(!room||!session)return;
    const last=room.history.at(-1),key=last?`${session.code}:${room.match}:${last.round}`:'';
    if(key&&key!==loadedReplay.current){loadedReplay.current=key;void openReplay(last!.round,room.match);}
    if(room.status!=='computing'||session.playerId!=='p0'||computing.current===room.computeId)return;
    // A refreshed coordinator cannot restore arbitrary Python globals. Let the lease expire.
    if(room.frames>0){setStatus('计算连接已重置；等待超时回到准备阶段后重新提交。');return;}
    computing.current=room.computeId;
    const executor=crypto.randomUUID(),captured=room,seat=session,task=new Computation(createWorld(room.players.map(p=>p.name),180,room.round-1),Object.fromEntries(room.players.map(p=>[p.id,p.program!])));
    work.current?.close();work.current=task;setStatus('房主正在统一计算所有已提交程序…');setProgress(0);
    (async()=>{
      try{
        applyRoom(await api({op:'claim',...seat,match:captured.match,round:captured.round,computeId:captured.computeId,executor}));
        await task.load();
        for(let start=0;start<900;start+=20){
          const frames=await task.batch();
          let acknowledged=false;
          for(let retry=0;retry<4&&!acknowledged;retry++){
            if(task.closed)throw Error('计算已取消');
            try{const view=await api({op:'batch',...seat,match:captured.match,round:captured.round,computeId:captured.computeId,executor,start,frames,errors:task.errors});applyRoom(view);acknowledged=true;}
            catch(e){const view=await api({op:'sync',...seat}) as RoomView;applyRoom(view);if(view.status==='computing'&&view.executor!==executor)throw e;if(view.history.some(h=>h.computeId===captured.computeId)||(view.computeId===captured.computeId&&view.frames>=start+frames.length))acknowledged=true;else if(view.status!=='computing'||view.computeId!==captured.computeId||retry===3)throw e;}
          }
          setProgress(Math.round((start+frames.length)/9));
        }
        setStatus('联机战报已生成，每位玩家独立播放。');
      }catch(e){if(!task.closed)setError(String(e));}
      finally{task.close();if(work.current===task){work.current=null;setProgress(null);}}
    })();
  },[room,session]);
  async function train(){
    if(busy||work.current)return;
    const gen=++generation.current,initial=createWorld(),task=new Computation(structuredClone(initial),{p0:{language,code},p1:null});
    work.current=task;setBusy(true);setError('');setProgress(0);setStatus('加载解释器并计算训练战报…');
    try{await task.load();if(task.errors.length)throw Error(task.errors.join('\n'));const frames:Replay['frames']=[];while(task.world.status==='running'){frames.push(...await task.batch());setProgress(Math.round(frames.length/9));await new Promise(resolve=>setTimeout(resolve,0));}if(gen!==generation.current)return;setReplay({initial,frames,errors:task.errors,final:structuredClone(task.world)});setReplayTitle('训练 · 你的程序 vs 巡游者');setBattle(true);setStatus(task.errors.length?'训练完成，运行错误已记录在战报中。':'训练战报已生成。修改策略后可再次运行。');}
    catch(e){if(gen===generation.current)setError(String(e));}
    finally{task.close();if(work.current===task)work.current=null;if(gen===generation.current){setBusy(false);setProgress(null);}}
  }
  function cancel(){generation.current++;work.current?.close();work.current=null;validation.current?.close();validation.current=null;setBusy(false);setProgress(null);setStatus('计算已取消，草稿已保留。');}
  async function prepare(){
    if(busy)return;const seat=sessionRef.current,view=roomRef.current;if(!seat||!view)return;
    if(view.players.find(p=>p.id===seat.playerId)?.ready){await roomAction('ready',{ready:false});return;}
    setBusy(true);setError('');setStatus('正在验证本次提交…');const r=new Runner(language);validation.current=r;
    try{await r.request('load',{},45000);await r.request('compile',{code});validateDecision(await r.request('decide',{observation:observe(createWorld(view.players.map(p=>p.name),180,view.round-1),seat.playerId),memory:{}}));if(sessionRef.current===seat&&await roomAction('ready',{ready:true,program:{language,code}}))setStatus('已提交并锁定这份代码；取消准备后可以重新提交。');}catch(e){setError(String(e));}finally{r.close();validation.current=null;setBusy(false);}
  }
  async function enter(op:string){setBusy(true);setError('');try{const data=await api({op,name,code:joinCode});cancel();const seat={code:data.code,token:data.token,playerId:data.playerId};sessionRef.current=seat;roomRef.current=null;computing.current='';loadedReplay.current='';setSession(seat);sessionStorage.setItem('codefront-seat',JSON.stringify(seat));applyRoom(data);setRoomModal(false);setStatus('所有成员提交后统一计算。');}catch(e){setError(String(e));}finally{setBusy(false);}}
  function leave(){cancel();sessionRef.current=null;roomRef.current=null;setSession(null);setRoom(null);sessionStorage.removeItem('codefront-seat');setError('');}
  const locked=busy||!!room?.players.find(p=>p.id===session?.playerId)?.ready&&room.status!=='computing';
  function switchLanguage(value:Program['language']){drafts.current[language]=code;setLanguage(value);setCode(drafts.current[value]);}
  useEffect(()=>{const el=editor.current;if(el){const parts=code.slice(0,el.selectionStart).split('\n');setCaret(`${parts.length}:${parts.at(-1)!.length+1}`);}},[code]);
  function locate(role:string){const el=editor.current;if(!el)return;const i=code.indexOf(language==='python'?`def ${role}(`:`function ${role}(`);if(i<0){setStatus('当前草稿使用旧版入口。载入分机器人示例可使用此导航。');return;}el.focus();el.setSelectionRange(i,i);el.scrollTop=Math.max(0,(code.slice(0,i).split('\n').length-3)*font*1.65);setCaret(`${code.slice(0,i).split('\n').length}:1`);}
  function download(){const url=URL.createObjectURL(new Blob([code],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=language==='python'?'strategy.py':'strategy.js';a.click();URL.revokeObjectURL(url);}
  return <div className="app-shell"><header className="topbar"><a className="brand" href="/"><span className="brand-mark"><Braces/></span><span>CODEFRONT<small>代码战场</small></span></a><nav><button className={!session?'nav-active':''} onClick={leave}>训练场</button><button className={session?'nav-active':''} onClick={()=>setRoomModal(true)}>多人房间 · 2–4</button></nav><div className="top-actions"><button className="plain-button" onClick={()=>setManual(true)}><BookOpen size={17}/>自选手册</button><a className="github-link" href="https://github.com/hjkc111/codinggame" target="_blank" rel="noreferrer">GitHub</a></div></header>
    <main className="workspace code-workspace"><div className="workspace-heading"><div><div className="eyebrow">WRITE. SIMULATE. REPLAY.</div><h1>三台机器人，三份独立策略。</h1></div><button className="secondary" onClick={()=>setBattle(true)}>打开战场</button></div>
      {session&&<><div className="room-strip"><span>房间 <strong>{session.code}</strong></span><span className="room-members">{room?.players.map(p=>p.name).join(' / ')}</span><button className="plain-button" onClick={async()=>{try{await navigator.clipboard.writeText(`${location.origin} 房间码 ${session.code}`);setStatus('网址和房间码已复制。');}catch{setStatus(`请手动复制房间码 ${session.code}`);}}}>复制邀请</button><button className="plain-button" onClick={leave}>返回训练</button></div>{room&&<SeriesPanel room={room} playerId={session.playerId} busy={busy} onReady={prepare} onAction={roomAction}/>}<p className="submission-note">提交后本轮源码对房间成员可见，房主浏览器负责执行，请勿包含密钥。全员提交才开始计算；房主计算期间保持页面开启。已生成战报可各自播放。</p><div className="toolbar">{room?.history.map(h=><button className="secondary" key={h.round} onClick={()=>openReplay(h.round)}>查看第 {h.round} 轮战报</button>)}</div></>}
      <section className="api-reference" aria-label="系统只读接口"><div className="reference-heading"><strong>系统接口 · 只读，无需修改</strong><span>坐标 960 × 640 · 每 0.2 秒决策 · 教程随时自选</span></div><div className="api-grid"><div><b>robot / 当前机器人</b><p><code>id, role, x, y</code> 编号、角色、坐标<br/><code>hp / maxHp</code> 当前 / 最大血量<br/><code>cargo / cargoSlots / capacity</code> 能量 / 已占格 / 容量<br/><code>alive</code> 是否存活</p></div><div><b>world / 当前战况</b><p><code>base</code> 自己的基地<br/><code>resources / enemies / robots</code> 资源 / 活敌 / 己方<br/><code>time / tick / scores</code> 模拟秒 / 步数 / 交付分<br/><code>memory</code> 各机器人独立、跨决策保留的记忆</p></div><div><b>直接调用，返回动作</b><p><code>robot.move_to(x, y)</code> 前往坐标<br/><code>robot.gather(target) / attack(enemy)</code> 采集 / 攻击<br/><code>robot.follow(points, memory)</code> 沿路线循环<br/><code>world.nearest_resource(robot)</code> 最近资源，可能为空</p></div></div><details><summary>展开带中文注释的完整接口源码（系统提供，不要复制到下方修改）</summary><pre className="reference-code">{sdk}</pre></details></section>
      <section className="panel strategy-panel" aria-label="策略编辑工作台"><div className="workspace-toolbar"><label>语言 <select aria-label="编程语言" value={language} disabled={locked} onChange={e=>switchLanguage(e.target.value as Program['language'])}><option value="python">Python</option><option value="javascript">JavaScript</option></select></label><div className="role-navigation">{['scout','guard','hauler'].map(role=><button key={role} className="plain-button" onClick={()=>locate(role)}>{role.toUpperCase()} ↗</button>)}</div><label>字号 <select aria-label="编辑器字号" value={font} onChange={e=>setFont(Number(e.target.value))}>{[14,16,18,20].map(v=><option key={v}>{v}</option>)}</select></label><button className="plain-button" onClick={download}><Download size={15}/>下载</button><label className="plain-button import-label"><Upload size={15}/>导入<input aria-label="导入策略" disabled={locked} type="file" accept=".py,.js,.txt" onChange={async e=>{const f=e.target.files?.[0];if(f){if(f.size>80000)setError('文件过大，代码最多 20,000 字符');else{const text=await f.text();if(text.length>20000)setError('代码最多 20,000 字符');else setCode(text);}}e.target.value='';}}/></label></div>
        <div className="workspace-toolbar run-toolbar"><button className="primary" disabled={busy||!!work.current||room?.status==='computing'} onClick={train}><Play size={17}/>运行训练</button>{session&&<button className="secondary" disabled={busy||!room||!['waiting','intermission'].includes(room.status)} onClick={prepare}>{room?.players.find(p=>p.id===session.playerId)?.ready?'取消准备':'验证并提交'}</button>}<button className="plain-button" disabled={locked} onClick={()=>{download();setCode(language==='python'?PYTHON:JAVASCRIPT);setStatus('旧草稿已下载备份，已载入分机器人示例。');}}>载入分机器人示例</button>{busy&&!session&&<button className="plain-button" onClick={cancel}>取消计算</button>}<span className="muted">{status}{progress!==null?` ${progress}%`:''}</span></div>
        {error&&<pre className="notice" role="alert">{error}<button className="plain-button" onClick={()=>setError('')}>收起</button></pre>}
        <textarea ref={editor} className="strategy-input" aria-label="策略代码" value={code} readOnly={locked} spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap="soft" style={{fontSize:font}} onChange={e=>setCode(e.target.value)} onSelect={e=>{const text=e.currentTarget.value.slice(0,e.currentTarget.selectionStart),parts=text.split('\n');setCaret(`${parts.length}:${parts.at(-1)!.length+1}`);}} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();void train();}if(e.key==='Tab'&&!locked){e.preventDefault();const el=e.currentTarget,start=el.selectionStart,end=el.selectionEnd;setCode(code.slice(0,start)+'    '+code.slice(end));requestAnimationFrame(()=>el.setSelectionRange(start+4,start+4));}}}/>
        <div className="editor-meta"><span>逻辑行:列 {caret} · {code.split('\n').length} 行 · {code.length}/20,000 字符</span><span>{locked?'已提交或验证中 · 取消准备后编辑':'草稿自动保存 · 自动折行 · Tab 缩进 · Ctrl+Enter 训练'}</span></div>
      </section><footer className="workspace-footer"><span>CODEFRONT v0.4 · 固定结果，独立播放</span><button onClick={()=>setManual(true)}>查看操作与策略手册 →</button></footer>
    </main>
    <ReplayViewer replay={replay} open={battle} onClose={()=>setBattle(false)} title={replayTitle}/>
    <dialog ref={manualDialog} className="manual-modal native-dialog" onCancel={()=>setManual(false)} onClose={()=>setManual(false)} aria-label="操作手册"><header><div><div className="eyebrow">FIELD MANUAL / 自选阅读</div><h2>边写边查，随时返回。</h2></div><button className="secondary" onClick={()=>setManual(false)}>关闭手册</button></header><div className="manual-layout"><nav>{chapters.map(([title],i)=><button key={title} className={chapter===i?'active':''} onClick={()=>setChapter(i)}>{i+1}. {title}</button>)}</nav><article><h3>{chapters[chapter][0]}</h3><p>{chapters[chapter][1]}</p><p className="muted">完整字段和工具函数也放在编程页上方的只读接口框，无需退出编辑器翻找。</p></article></div></dialog>
    <dialog ref={roomDialog} className="room-modal native-dialog" onCancel={()=>setRoomModal(false)} onClose={()=>setRoomModal(false)} aria-label="多人房间"><header><div><Users/><h2>召集你的对手</h2></div><button className="plain-button" onClick={()=>setRoomModal(false)}>关闭</button></header><p>公开网址 + 房间码，2–4 人自由对战。</p><label>昵称<input value={name} maxLength={20} onChange={e=>setName(e.target.value)}/></label><button className="primary" disabled={busy||room?.status==='computing'} onClick={()=>enter('create')}>创建房间</button><label>六位房间码<input value={joinCode} maxLength={6} onChange={e=>setJoinCode(e.target.value.toUpperCase())}/></label><button className="secondary" disabled={busy||room?.status==='computing'} onClick={()=>enter('join')}>加入房间</button>{error&&<p className="error">{error}</p>}</dialog>
  </div>;
}
