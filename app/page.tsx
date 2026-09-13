'use client';
import {useEffect,useRef,useState} from 'react';
import {Play,Pause,RotateCcw,BookOpen,Users,Code2,Terminal,ArrowUpRight,Radio,Target,ChevronRight,X,Copy,Check,Flag,Zap,ScanLine,Braces,Upload,Download} from 'lucide-react';
import Arena from '@/components/Arena';
import {createWorld,advance,acceptActions,observe,botActions,type World,type Actions} from '@/lib/game';
import {PYTHON,JAVASCRIPT} from '@/lib/templates';
import {Runner} from '@/lib/runner';

type Session={code:string;token:string;playerId:string};
type RoomView={code:string;status:string;players:{id:string;name:string}[];world:World|null};
const clock=(s:number)=>`${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`;
const idle=(w:World,id:string)=>Object.fromEntries(w.robots.filter(r=>r.owner===id).map(r=>[r.id,{type:'idle'}]));
function highlight(code:string){return code.split(/(#[^\n]*|\/\/[^\n]*|"[^"\n]*"|'[^'\n]*'|\b(?:def|return|for|in|if|elif|else|continue|and|or|not|function|const|let|of|true|false)\b|\b\d+(?:\.\d+)?\b)/g).map((text,i)=><span key={i} className={text.startsWith('#')||text.startsWith('//')?'tok-comment':/^['"]/.test(text)?'tok-string':/^\d/.test(text)?'tok-number':/^(def|return|for|in|if|elif|else|continue|and|or|not|function|const|let|of|true|false)$/.test(text)?'tok-key':''}>{text}</span>);}
const chapters=[
  {title:'开始一场训练',text:'无需完成任何课程。保持左侧 Python 示例，点击「运行策略」。解释器就绪后，三台机器人会按照你的代码寻找资源、采集并运回基地。每一分都来自实际交付。',steps:['点击机器人或下方队伍卡片，查看血量、载量和目标。','点击暂停可冻结训练；1× 可以切换到 2×。','修改代码后点击「部署修改」，成功后新的版本才生效。','点击重置开始新局，保留编辑草稿。训练和联机使用相同的战斗规则。'],code:'def decide(observation, memory):\n    actions = {}\n    # 为每台机器人选择动作\n    return actions, memory'},
  {title:'战况与动作 API',text:'每约 250 毫秒接收一次 observation。所有位置都是世界坐标，左上角 (0, 0)，右下角 (960, 640)。Python 返回 actions, memory；JavaScript 返回 [actions, memory]。',steps:['robots：自己的机器人。字段为 id、role、alive、x、y、hp、maxHp、cargo、capacity。','base：自己的基地坐标。resources：尚未采完的资源，包含 id、x、y、amount、value。enemies：活着的敌人。','move：前往坐标；gather：接近目标并采集；attack：接近敌人并攻击；idle：取消任务。未指定则延续旧任务。','进入基地 43 单位内自动卸货并恢复血量。无目标或目标消失时等待下一次决策。第一版无障碍物和战争迷雾。'],code:'actions[robot["id"]] = {\n    "type": "move", "x": 480, "y": 320\n}\n# 也可以使用：\n# {"type": "gather", "target_id": resource["id"]}\n# {"type": "attack", "target_id": enemy["id"]}\n# {"type": "idle"}'},
  {title:'让策略变得聪明',text:'从满载返航开始，逐步尝试不同角色分工。Scout 快、Guard 耐打、Hauler 载量大。先确保能得分，再优化路线和对抗。',steps:['将返航阈值从 capacity 改为 capacity * 0.6，对比运输次数与总得分。','Guard 遇到近处敌人时攻击，其余机器人继续采集。','resources 或 enemies 可能为空，调用 min 前先检查。','memory 用于保存跨次数据。只保存可以转为 JSON 的字典、列表、字符串、数字和布尔值，最大约 64 KB。'],code:'memory["decisions"] = memory.get("decisions", 0) + 1\n\n# 把这一判断放在采集分支前，可让 Guard 参战：\n# elif robot["role"] == "Guard" and observation["enemies"]:\n#     enemy = min(observation["enemies"], key=lambda e:\n#         (e["x"]-robot["x"])**2 + (e["y"]-robot["y"])**2)\n#     actions[robot["id"]] = {"type":"attack", "target_id":enemy["id"]}'},
  {title:'邀请朋友联机',text:'点击「多人房间」，填写昵称后创建房间。朋友打开同一网址，输入六位房间码加入。第一版支持 2–4 人自由混战，每人独立控制三台机器人。',steps:['私有站点的朋友需要先获得站点访问权限；房间码不能绕过网站权限。','至少两人进入后，房主点击开始。各玩家点击运行策略，让自己的程序接管小队。','联机不能个人暂停；可以继续编辑并部署。比赛三分钟，交付分数最高者获胜，同分并列。','刷新会恢复当前标签页席位。离线时保留最后动作，但 Python 不会在后台继续决策。第一版是客户端执行的休闲对战，不提供排位。'],code:'共享的是同一场云端比赛\n程序 → 动作 → 云端校验和结算 → 所有人看到结果'},
  {title:'错误与运行限制',text:'这是真实 Python 解释器，不是模拟解析器。首次加载需要下载运行时，之后浏览器会缓存。所有运行发生在独立 Worker 中，超时会终止解释器。',steps:['IndentationError：检查缩进，统一使用空格。KeyError：对照 API 字段名称。','需要返回 actions, memory，不能只返回 actions。memory 和动作不能包含函数或循环引用。','单次执行超过约 1.2 秒会被终止；请避免 while True、巨大循环和无限递归。','错误显示后修改代码并重新运行。草稿自动保存在本机；不是云端代码备份，可用下载按钮导出。不要运行来源不明的代码。'],code:'# 不需要自己写无限循环，系统会重复调用 decide。\n# 调试可以 print，但输出会截断。\nprint(observation["tick"])'},
];

export default function Home(){
  const [world,setWorld]=useState(()=>createWorld()),worldRef=useRef(world);
  const [running,setRunning]=useState(true),runningRef=useRef(true),[demo,setDemo]=useState(true),demoRef=useRef(true);
  const [language,setLanguage]=useState('python'),[code,setCode]=useState(PYTHON),[activeCode,setActiveCode]=useState(''),[activeLanguage,setActiveLanguage]=useState(''),[version,setVersion]=useState(0);
  const [loading,setLoading]=useState(false),[runtime,setRuntime]=useState('示例脚本演示'),[error,setError]=useState(''),[logs,setLogs]=useState<string[]>([]),[speed,setSpeed]=useState(1);
  const [selected,setSelected]=useState<string|null>('p0-0'),[guides,setGuides]=useState(true),[manual,setManual]=useState(false),[chapter,setChapter]=useState(0);
  const [roomModal,setRoomModal]=useState(false),[name,setName]=useState('指挥官'),[joinCode,setJoinCode]=useState(''),[session,setSession]=useState<Session|null>(null),[room,setRoom]=useState<RoomView|null>(null),[busy,setBusy]=useState(false),[netError,setNetError]=useState(''),[copied,setCopied]=useState(false);
  const runner=useRef<Runner|null>(null),candidate=useRef<Runner|null>(null),memory=useRef<any>({}),actions=useRef<Actions>({}),sequence=useRef(Date.now()),sessionRef=useRef<Session|null>(null),generation=useRef(0);
  const editorPre=useRef<HTMLPreElement>(null),gutter=useRef<HTMLDivElement>(null),hydrated=useRef(false),drafts=useRef<Record<string,string>>({python:PYTHON,javascript:JAVASCRIPT});
  const playerId=session?.playerId||'p0';const own=world.robots.filter(r=>r.owner===playerId);const focused=world.robots.find(r=>r.id===selected);
  const publishWorld=(w:World)=>{worldRef.current=w;setWorld(structuredClone(w));};
  function stopRunner(){generation.current++;candidate.current?.close();candidate.current=null;runner.current?.close();runner.current=null;memory.current={};actions.current={};setLoading(false);setVersion(0);setActiveCode('');setActiveLanguage('');}
  useEffect(()=>{
    try{const d=JSON.parse(localStorage.getItem('codefront-drafts')||'null');if(d&&typeof d.python==='string'&&typeof d.javascript==='string'){drafts.current=d;setCode(d.python);}const saved=JSON.parse(sessionStorage.getItem('codefront-seat')||'null');if(saved?.token&&saved?.code){sessionRef.current=saved;setSession(saved);demoRef.current=false;setDemo(false);setRuntime('等待运行策略');}}
    catch{}hydrated.current=true;
    return()=>{candidate.current?.close();runner.current?.close();};
  },[]);
  useEffect(()=>{if(!hydrated.current)return;drafts.current[language]=code;try{localStorage.setItem('codefront-drafts',JSON.stringify(drafts.current));}catch{}},[code,language]);
  useEffect(()=>{runningRef.current=running;},[running]);
  useEffect(()=>{
    if(session)return;
    let last=performance.now(),counter=0;
    const timer=setInterval(()=>{
      const now=performance.now(),dt=Math.min((now-last)/1000,.15);last=now;
      if(!runningRef.current)return;const w=worldRef.current;
      if(counter++%4===0){for(const p of w.players)if(p.id!=='p0'||demoRef.current)acceptActions(w,p.id,botActions(w,p.id));}
      advance(w,dt*speed);setWorld(structuredClone(w));
      if(w.status==='finished'){runningRef.current=false;setRunning(false);}
    },50);return()=>clearInterval(timer);
  },[session,speed]);
  useEffect(()=>{
    let closed=false,timer:ReturnType<typeof setTimeout>;
    const decide=async()=>{
      const r=runner.current,s=sessionRef.current,w=worldRef.current;
      if(r&&!r.closed&&runningRef.current&&w.status==='running'&&(!s||room?.status==='running')){
        try{const result=await r.request('decide',{observation:observe(w,s?.playerId||'p0'),memory:memory.current});
          if(closed||r!==runner.current)return;
          if(!result.actions||typeof result.actions!=='object'||Array.isArray(result.actions))throw Error('actions 必须是机器人 ID 到动作的字典');
          if(JSON.stringify(result.memory).length>65536)throw Error('memory 超过 64 KB');
          memory.current=result.memory;actions.current=result.actions;
          if(!s)acceptActions(worldRef.current,'p0',result.actions);
          if(result.output?.length)setLogs(old=>[...old,...result.output].slice(-20));
        }catch(e){if(!closed&&r===runner.current){r.close();runner.current=null;setError(String(e));setRuntime('策略已停止');actions.current=idle(w,s?.playerId||'p0') as Actions;if(!s){acceptActions(w,'p0',actions.current);setRunning(false);runningRef.current=false;}}}
      }
      if(!closed)timer=setTimeout(decide,250);
    };timer=setTimeout(decide,250);return()=>{closed=true;clearTimeout(timer);};
  },[room?.status]);
  async function api(body:object){const response=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json() as RoomView & Session & {error?:string};if(!response.ok)throw Error(data.error||'连接失败');return data;}
  useEffect(()=>{
    if(!session)return;let closed=false;let timer:ReturnType<typeof setTimeout>;
    const sync=async()=>{
      try{const data=await api({op:'sync',...session,seq:++sequence.current,actions:actions.current});if(closed)return;setRoom(data);setNetError('');if(data.world){publishWorld(data.world);if(data.status==='finished'){setRunning(false);runningRef.current=false;}}}
      catch(e){if(!closed)setNetError(String(e));}
      if(!closed)timer=setTimeout(sync,400);
    };sync();return()=>{closed=true;clearTimeout(timer);};
  },[session]);
  useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){setManual(false);setRoomModal(false);}};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[]);
  async function deploy(){
    if(loading)return;const gen=++generation.current;setLoading(true);setError('');setRuntime(language==='python'?'正在加载 Python 解释器…':'正在加载 JavaScript…');const next=new Runner(language);candidate.current=next;
    try{
      await next.request('load',{},45000);await next.request('compile',{code});
      const result=await next.request('decide',{observation:observe(worldRef.current,sessionRef.current?.playerId||'p0'),memory:{}});
      if(!result.actions||typeof result.actions!=='object'||Array.isArray(result.actions))throw Error('actions 必须是字典');
      if(JSON.stringify(result.memory).length>65536)throw Error('memory 超过 64 KB');
      if(gen!==generation.current){next.close();return;}
      runner.current?.close();runner.current=next;candidate.current=null;memory.current=result.memory;actions.current=result.actions;
      if(demoRef.current&&!sessionRef.current){publishWorld(createWorld());}
      demoRef.current=false;setDemo(false);if(!sessionRef.current)acceptActions(worldRef.current,'p0',result.actions);
      setVersion(v=>v+1);setActiveCode(code);setActiveLanguage(language);setRuntime(language==='python'?'Python 正在执行':'JavaScript 正在执行');setRunning(true);runningRef.current=true;
      setLogs(old=>[...old,`部署成功 · ${language} · 收到 ${Object.keys(result.actions).length} 台机器人动作`].slice(-20));
    }catch(e){next.close();if(gen===generation.current){setError(String(e));setRuntime(runner.current?'部署失败，旧版本继续运行':'解释器未启动');}}
    finally{if(gen===generation.current)setLoading(false);}
  }
  function reset(){stopRunner();demoRef.current=false;setDemo(false);setRunning(false);runningRef.current=false;publishWorld(createWorld());setRuntime('等待运行策略');setError('');setLogs([]);}
  function training(){stopRunner();sessionRef.current=null;setSession(null);setRoom(null);sessionStorage.removeItem('codefront-seat');demoRef.current=true;setDemo(true);publishWorld(createWorld());setRunning(true);runningRef.current=true;setRuntime('示例脚本演示');setNetError('');}
  async function enterRoom(op:string){
    setBusy(true);setNetError('');try{const data=await api({op,name,code:joinCode.toUpperCase()});stopRunner();const s={code:data.code,token:data.token,playerId:data.playerId};sessionRef.current=s;setSession(s);sessionStorage.setItem('codefront-seat',JSON.stringify(s));setRoom(data);demoRef.current=false;setDemo(false);publishWorld(createWorld(data.players.map((p:any)=>p.name)));setRuntime('等待运行策略');setRoomModal(false);setRunning(true);runningRef.current=true;setSelected(`${s.playerId}-0`);}catch(e){setNetError(String(e));}finally{setBusy(false);}
  }
  async function startRoom(){setBusy(true);try{const data=await api({op:'start',...session});setRoom(data);if(data.world)publishWorld(data.world);setNetError('');}catch(e){setNetError(String(e));}finally{setBusy(false);}}
  function switchLanguage(value:string){drafts.current[language]=code;setLanguage(value);setCode(drafts.current[value]);}
  async function copyRoom(){try{await navigator.clipboard.writeText(session!.code);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{setNetError('复制失败，请手动复制房间码');}}
  function download(){const blob=new Blob([code],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=language==='python'?'strategy.py':'strategy.js';a.click();URL.revokeObjectURL(url);}
  const changed=activeCode!==code||activeLanguage!==language;
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="/" aria-label="Codefront 首页"><span className="brand-mark"><Braces size={25}/></span><span>CODEFRONT<small>代码战场</small></span></a><nav aria-label="主导航"><button className={!session?'nav-active':''} onClick={()=>{if(session)training();}}>训练场</button><button className={session?'nav-active':''} onClick={()=>setRoomModal(true)}>多人房间 <span className="tiny-tag">2–4</span></button></nav><div className="top-actions"><span className="edition">PLAYGROUND / 01</span><button className="plain-button" onClick={()=>setManual(true)}><BookOpen size={17}/>手册</button><a href="https://github.com/hjkc111/codinggame" target="_blank" rel="noreferrer" className="github-link" aria-label="查看 GitHub 源代码"><Code2 size={19}/></a></div></header>
    <main className="workspace">
      <div className="workspace-heading"><div><div className="eyebrow">{session?'MULTIPLAYER ARENA':'YOUR CODE. YOUR SQUAD.'}</div><h1>{session?'小队已集结':'让代码，进入战场。'}</h1></div><div className="heading-note"><span className="label-dot"/>{session?'云端结算 · 自由混战':'采集 · 运回基地 · 争夺核心'}<span className="muted">三台机器人，一个策略。</span></div></div>
      {session&&<section className="room-strip" aria-label="当前房间"><span>房间 <strong>{session.code}</strong></span><button className="icon-button" onClick={copyRoom} aria-label="复制房间码">{copied?<Check size={16}/>:<Copy size={16}/>}</button><span className="room-members">{room?.players.map(p=>p.name).join(' / ')}</span><span>{room?.players.length||1}/4 人</span>{room?.status==='waiting'&&(session.playerId==='p0'?<button className="primary small" disabled={busy||(room?.players.length||0)<2} onClick={startRoom}>开始比赛</button>:<span>等待房主开始</span>)}<button className="plain-button" onClick={training}>返回训练</button></section>}
      {netError&&<div className="notice error" role="alert">{netError}</div>}
      <div className="battle-layout">
        <section className="editor-panel panel">
          <div className="panel-bar"><span className="file-tab"><Code2 size={16}/>{language==='python'?'strategy.py':'strategy.js'}<span className={changed?'unsaved':''}/></span><select aria-label="编程语言" value={language} onChange={e=>switchLanguage(e.target.value)}><option value="python">Python</option><option value="javascript">JavaScript</option></select></div>
          <div className="editor-tools"><span><span className="mint">ƒ</span> decide(observation, memory)</span><button className="icon-button" onClick={download} aria-label="下载代码"><Download size={15}/></button></div>
          <div className="code-editor"><div ref={gutter} className="line-numbers" aria-hidden="true">{code.split('\n').map((_,i)=><div key={i}>{i+1}</div>)}</div><div className="code-content"><pre ref={editorPre} aria-hidden="true">{highlight(code)}{'\n'}</pre><textarea aria-label="策略代码编辑器" value={code} spellCheck={false} onChange={e=>setCode(e.target.value)} onScroll={e=>{if(editorPre.current){editorPre.current.scrollTop=e.currentTarget.scrollTop;editorPre.current.scrollLeft=e.currentTarget.scrollLeft;}if(gutter.current)gutter.current.scrollTop=e.currentTarget.scrollTop;}} onKeyDown={e=>{if(e.key==='Tab'){e.preventDefault();const el=e.currentTarget,start=el.selectionStart,end=el.selectionEnd;setCode(code.slice(0,start)+'    '+code.slice(end));requestAnimationFrame(()=>{el.selectionStart=el.selectionEnd=start+4;});}if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();deploy();}}}/></div></div>
          <div className="editor-meta"><span>UTF-8 · {language==='python'?'4 spaces':'2 spaces'}</span><span>{version?`运行 v${version}${changed?' · 草稿已修改':''}`:'本机自动保存'}</span></div>
          <div className="run-area"><button className="primary run-button" disabled={loading} onClick={deploy}>{loading?<span className="spinner"/>:version?<Upload size={17}/>:<Play size={17} fill="currentColor"/>}{loading?'解释器加载中…':version?'部署修改':'运行策略'}<kbd>Ctrl ↵</kbd></button><div className="runtime-status"><span className={loading?'amber':'mint'}>●</span>{runtime}</div></div>
        </section>
        <div className="arena-column"><section className="arena-panel panel"><div className="panel-bar arena-bar"><div className="arena-title"><span className="live-indicator"/><strong>交汇之地</strong><span className="map-tag">SECTOR 01</span></div><span className="match-time"><Flag size={14}/>{clock(world.duration-world.time)}</span></div>
          <div className="scoreboard">{world.players.map((p,i)=><div className="score-item" key={p.id}><span className="team-index" style={{color:p.color}}>0{i+1}</span><span>{p.name}</span><strong style={{color:p.color}}>{p.score}<small> EP</small></strong></div>)}</div>
          <div className="arena-wrap"><Arena world={world} selected={selected} onSelect={setSelected} guides={guides} running={running}/><span className="arena-mode">{session?'ONLINE / 云端房间':demo?'DEMO / 示例脚本':'TRAINING / 你的策略'}</span>{session&&room?.status==='waiting'&&<div className="arena-overlay"><Users size={32}/><h2>等待队友加入</h2><p>分享房间码 {session.code}，至少两人即可开始。</p><p className="muted">可以先编辑策略，比赛开始后点击运行。</p></div>}{world.status==='finished'&&<div className="arena-overlay result"><Flag size={32}/><h2>{world.players.filter(p=>p.score===Math.max(...world.players.map(p=>p.score))).map(p=>p.name).join(' & ')} 获胜</h2><p>本局已结束 · 能源已完成结算</p>{!session&&<button className="primary" onClick={reset}>再次挑战</button>}</div>}</div>
          <div className="arena-controls"><div>{!session&&<><button className="icon-button" aria-label={running?'暂停训练':'继续训练'} onClick={()=>{setRunning(!running);runningRef.current=!running;}}>{running?<Pause size={17}/>:<Play size={17}/>}</button><button className="icon-button" aria-label="重置训练" onClick={reset}><RotateCcw size={16}/></button><button className="speed-button" onClick={()=>setSpeed(speed===1?2:1)}>{speed}×</button></>}<span className="timeline-label">{clock(world.time)}</span><div className="timeline"><span style={{width:`${world.time/world.duration*100}%`}}/></div></div><button className={'guide-toggle '+(guides?'on':'')} onClick={()=>setGuides(!guides)}><ScanLine size={16}/>战术辅助</button></div>
        </section>
        <section className="squad-panel"><div className="section-label"><span>你的小队</span><span>{own.filter(r=>r.alive).length} / 3 ACTIVE</span></div><div className="squad-cards">{own.map((r,i)=><button className={'robot-card '+(selected===r.id?'selected':'')} key={r.id} onClick={()=>setSelected(r.id)}><div className="robot-card-heading"><span className="robot-symbol">{i===0?<Radio size={21}/>:i===1?<Target size={21}/>:<Zap size={21}/>}</span><span>{r.role}<small>{i===0?'侦察机':i===1?'守卫机':'运输机'}</small></span><span className="robot-number">0{i+1}</span></div><div className="hp-track"><span style={{width:`${r.hp/r.maxHp*100}%`}}/></div><div className="robot-stats"><span>{r.alive?`${Math.round(r.hp)} HP`:'重生中'}</span><span>{r.cargo} / {r.capacity} EP</span></div></button>)}</div></section>
        </div>
      </div>
      <section className="bottom-panel panel"><div className="console-column"><div className="section-label"><span><Terminal size={15}/>运行终端</span><span>{error?'ERROR':`TICK ${world.tick}`}</span></div>{error?<pre className="error console-error" role="alert">{error}</pre>:<div className="console-lines">{logs.length?logs.slice(-3).map((l,i)=><div key={i}><span className="mint">›</span> {l}</div>):<><div><span className="mint">›</span> {demo?'正在展示内置脚本。点击「运行策略」接管你的小队。':'解释器输出和部署记录将显示在这里。'}</div><div className="muted">{session?'每位玩家独立运行代码，云端统一计算战斗。':'修改返航条件，观察一次策略改变带来的不同。'}</div></>}</div>}</div><div className="inspection-column"><div className="section-label"><span>决策观察</span><span>{focused?.id}</span></div><div className="inspector"><span className="mint">{focused?.role}</span><ChevronRight size={15}/><span>{focused?.action.type==='gather'?'采集能源':focused?.action.type==='move'?'移动中':focused?.action.type==='attack'?'锁定敌人':'等待指令'}</span><span className="muted">{focused?.action.target_id||`${Math.round(focused?.x||0)}, ${Math.round(focused?.y||0)}`}</span></div><div className="last-event">{[...world.events].reverse().find(e=>['score','death','core'].includes(e.kind))?.text||'点击战场上的机器人，跟踪它的实时决策。'}</div></div></section>
      <footer className="workspace-footer"><span>CODEFRONT <span className="muted">/ EARLY ACCESS 0.1</span></span><button onClick={()=>setManual(true)}>不确定怎么写？随时翻开手册 <ArrowUpRight size={14}/></button></footer>
    </main>
    {manual&&<div className="modal-backdrop" onClick={()=>setManual(false)}><section className="manual-modal" role="dialog" aria-modal="true" aria-label="编程手册" onClick={e=>e.stopPropagation()}><header><div><div className="eyebrow">FIELD MANUAL</div><h2>编程手册</h2><p>按需查阅，没有必修关卡。</p></div><button autoFocus className="icon-button" aria-label="关闭手册" onClick={()=>setManual(false)}><X/></button></header><div className="manual-layout"><nav>{chapters.map((c,i)=><button className={chapter===i?'active':''} key={c.title} onClick={()=>setChapter(i)}><span>0{i+1}</span>{c.title}</button>)}</nav><article><h3>{chapters[chapter].title}</h3><p>{chapters[chapter].text}</p><ol>{chapters[chapter].steps.map(s=><li key={s}>{s}</li>)}</ol><pre>{chapters[chapter].code}</pre><button className="plain-button" onClick={()=>setManual(false)}>回到战场 <ArrowUpRight size={16}/></button></article></div></section></div>}
    {roomModal&&<div className="modal-backdrop" onClick={()=>setRoomModal(false)}><section className="room-modal" role="dialog" aria-modal="true" aria-label="多人房间" onClick={e=>e.stopPropagation()}><header><div><div className="eyebrow">BRING YOUR SQUAD</div><h2>和朋友，写一场对决。</h2></div><button className="icon-button" aria-label="关闭房间面板" onClick={()=>setRoomModal(false)}><X/></button></header><p>2–4 人自由混战。真实代码，同一片战场。</p><label>你的昵称<input autoFocus maxLength={20} value={name} onChange={e=>setName(e.target.value)}/></label><button className="primary" disabled={busy||!name.trim()} onClick={()=>enterRoom('create')}><Users size={17}/>创建新房间</button><div className="or-divider">或加入朋友的房间</div><label>六位房间码<input maxLength={6} placeholder="例如 A1B2C3" value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())}/></label><button className="secondary" disabled={busy||joinCode.length!==6||!name.trim()} onClick={()=>enterRoom('join')}>加入房间 <ChevronRight size={17}/></button>{netError&&<p role="alert" className="error">{netError}</p>}<p className="small-note">休闲对战 · Python 在各自浏览器运行。私有站点需先为朋友开放访问权限。</p></section></div>}
  </div>;
}

