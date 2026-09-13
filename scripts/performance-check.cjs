const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs');fs.mkdirSync('.qa',{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),pages=[],errors=[];
 for(let i=0;i<3;i++){const c=await browser.newContext({viewport:{width:1440,height:1100}});await c.addInitScript(()=>{window.__perf={rtt:[],gaps:[],frames:[],last:0};const original=window.fetch;window.fetch=async(...args)=>{const start=performance.now(),r=await original(...args);if(String(args[0]).includes('/api/rooms')&&String(args[1]?.body).includes('"op":"sync"')){const now=performance.now(),m=window.__perf;m.rtt.push(now-start);if(m.last)m.gaps.push(now-m.last);m.last=now;}return r;};let prev=0;const frame=t=>{if(prev)window.__perf.frames.push(t-prev);prev=t;requestAnimationFrame(frame);};requestAnimationFrame(frame);});const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.TEST_URL||'http://localhost:5173/');pages.push(p);}
 await pages[0].getByRole('button',{name:/多人房间/}).click();await pages[0].getByLabel('你的昵称').fill('Alpha');await pages[0].getByRole('button',{name:'创建新房间'}).click();await pages[0].locator('.room-strip strong').waitFor();const code=await pages[0].locator('.room-strip strong').textContent();
 for(let i=1;i<3;i++){await pages[i].getByRole('button',{name:/多人房间/}).click();await pages[i].getByLabel('你的昵称').fill(i===1?'Bravo':'Charlie');await pages[i].getByLabel('六位房间码').fill(code);await pages[i].getByRole('button',{name:'加入房间',exact:false}).click();await pages[i].locator('.room-strip').waitFor();}
 await pages[0].getByText('3/4 人',{exact:true}).waitFor();await pages[1].getByLabel('编程语言').selectOption('javascript');
 // Validate actual Python/JS before the match, and edit to cancel readiness.
 await pages[0].getByRole('button',{name:'验证并准备',exact:true}).click();await pages[0].getByRole('button',{name:'取消准备',exact:true}).waitFor({timeout:60000});
 const original=await pages[0].getByLabel('策略代码编辑器').inputValue();await pages[0].getByLabel('策略代码编辑器').fill(original+'\n# round-series test');await pages[0].getByRole('button',{name:'验证并准备',exact:true}).waitFor();
 const drafts=await Promise.all(pages.map(p=>p.getByLabel('策略代码编辑器').inputValue()));
 const snapshots=[];
 for(let round=1;round<=3;round++){
   for(const p of pages){await p.getByRole('button',{name:'验证并准备',exact:true}).click();await p.getByRole('button',{name:'取消准备',exact:true}).waitFor({timeout:60000});}
   await pages[0].getByRole('button',{name:'取消准备',exact:true}).waitFor({state:'hidden',timeout:10000});
   console.log(`Round ${round} started with real interpreters`);
   await pages[0].waitForTimeout(15000);
   const scoreTexts=await pages[0].locator('.score-item strong').allTextContents();
   if(scoreTexts.some(s=>parseInt(s)<=0))throw Error('Live UI player did not deliver');
   const color=await pages[0].locator('.series-heading h2 span').evaluate(el=>getComputedStyle(el).color);
   
   await pages[0].screenshot({path:'.qa/live-series.png',fullPage:true});
   const metrics=await Promise.all(pages.map(p=>p.evaluate(()=>{const m=window.__perf;const med=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];return {rttMedian:med(m.rtt.slice(-40)),snapshotGapMedian:med(m.gaps.slice(-40)),frameGapMedian:med(m.frames),slowFramePercent:m.frames.filter(n=>n>34).length/m.frames.length*100};})));fs.writeFileSync(process.env.PERF_OUTPUT||'.qa/performance.json',JSON.stringify(metrics,null,2));console.log(JSON.stringify({metrics,liveThreePlayerUI:true,readyAndEdit:true,actualScores:scoreTexts,roundLabelColor:color,errors}));
   if(errors.length)throw Error(errors.join('\n'));await browser.close();return;
 }
})().catch(e=>{console.error(e);process.exit(1)});
