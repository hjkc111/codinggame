const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs');fs.mkdirSync('.qa',{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1100}});const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.TEST_URL || 'http://localhost:5173/'));await page.waitForTimeout(1500);
 await page.getByRole('button',{name:'运行策略',exact:false}).click();
 await page.locator('.runtime-status').filter({hasText:'Python 正在执行'}).waitFor({timeout:60000});
 await page.waitForTimeout(4500);
 await page.screenshot({path:'.qa/desktop.png',fullPage:true});
 await page.getByRole('button',{name:'暂停训练',exact:true}).click();
 const before=await page.locator('.match-time').textContent();await page.waitForTimeout(900);const after=await page.locator('.match-time').textContent();if(before!==after)throw Error('Pause failed');
 await page.getByLabel('策略代码编辑器').fill('def decide(observation, memory):\n    return {r["id"]: {"type":"move", "x":480, "y":320} for r in observation["robots"]}, memory');
 await page.getByRole('button',{name:'部署修改',exact:false}).click();await page.getByText('运行 v2',{exact:true}).waitFor({timeout:45000});
 await page.waitForTimeout(1000);if(!(await page.locator('.inspector').textContent()).includes('移动中'))throw Error('Python change had no effect');
 await page.getByLabel('策略代码编辑器').fill('def decide(observation, memory):\n    while True:\n        pass');
 await page.getByRole('button',{name:'部署修改',exact:false}).click();await page.getByRole('alert').filter({hasText:'运行超时'}).waitFor({timeout:45000});
 await page.getByRole('button',{name:'手册',exact:true}).click();await page.getByRole('dialog',{name:'编程手册'}).waitFor();await page.screenshot({path:'.qa/manual-ui.png'});await page.getByRole('button',{name:'关闭手册'}).click();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.qa/mobile.png',fullPage:true});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw Error('Mobile overflow');
 await page.setViewportSize({width:1440,height:1000});
 const clients=[];for(let i=0;i<3;i++){const c=await browser.newContext();const p=await c.newPage();await p.goto((process.env.TEST_URL || 'http://localhost:5173/'));clients.push(p);}
 const call=(p,body)=>p.evaluate(async b=>{const r=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});return {status:r.status,data:await r.json()};},body);
 const created=await call(clients[0],{op:'create',name:'Alpha'});if(created.status!==200)throw Error(JSON.stringify(created));
 const seats=[created.data];for(let i=1;i<3;i++){const joined=await call(clients[i],{op:'join',name:['','Bravo','Charlie'][i],code:created.data.code});if(joined.status!==200)throw Error(JSON.stringify(joined));seats.push(joined.data);}
 const forbidden=await call(clients[1],{op:'timer',code:seats[0].code,token:seats[1].token,match:1,round:1,seconds:600});if(forbidden.status!==409)throw Error('Host auth failed');
 for(let i=0;i<3;i++){const ready=await call(clients[i],{op:'ready',code:seats[i].code,token:seats[i].token,match:1,round:1,ready:true});if(ready.status!==200)throw Error(JSON.stringify(ready));}
 await page.waitForTimeout(3200);
 for(let n=0;n<5;n++){await Promise.all(clients.map((p,i)=>call(p,{op:'sync',match:1,round:1,code:seats[i].code,token:seats[i].token,seq:n,actions:{[`${seats[i].playerId}-0`]:{type:'move',x:480,y:320}}})));await page.waitForTimeout(420);}
 const snapshots=await Promise.all(clients.map((p,i)=>call(p,{op:'sync',match:1,round:1,code:seats[i].code,token:seats[i].token,seq:10,actions:{}})));
 if(snapshots.some(s=>s.status!==200||s.data.world.players.length!==3))throw Error('Room sync failed');
 const late=await call(page,{op:'join',code:seats[0].code,name:'Late'});if(late.status!==409)throw Error('Late join allowed');
 fs.writeFileSync('.qa/browser-results.json',JSON.stringify({python:true,modify:true,pause:true,timeout:true,mobileOverflow:overflow,threePlayers:true,hostAuthorization:true,lateJoinRejected:true,errors,snapshotTimes:snapshots.map(s=>s.data.world.time)},null,2));
 console.log(fs.readFileSync('.qa/browser-results.json','utf8'));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});



