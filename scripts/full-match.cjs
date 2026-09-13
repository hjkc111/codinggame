const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('assert/strict'),fs=require('fs');
const url=process.env.TEST_URL||'http://127.0.0.1:8787';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const pages=[],errors=[];for(let i=0;i<3;i++){const context=await browser.newContext({viewport:{width:1280,height:960}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);pages.push(page);}
 const call=(page,body)=>page.evaluate(async b=>{const response=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});const data=await response.json();if(!response.ok)throw Error(JSON.stringify(data));return data;},body);
 const created=await call(pages[0],{op:'create',name:'Alpha'}),seats=[created];for(let i=1;i<3;i++)seats.push(await call(pages[i],{op:'join',code:created.code,name:['','Bravo','Charlie'][i]}));
 for(let i=0;i<3;i++){await pages[i].evaluate(s=>sessionStorage.setItem('codefront-seat',JSON.stringify({code:s.code,token:s.token,playerId:s.playerId})),seats[i]);await pages[i].reload();await pages[i].getByRole('region',{name:'赛程与复盘'}).waitFor();}
 await pages[2].getByLabel('编程语言').selectOption('javascript');
 const rounds=[];
 for(let round=1;round<=3;round++){
  const started=Date.now();
  for(const p of pages)await p.getByRole('region',{name:'赛程与复盘'}).getByRole('button',{name:'验证并提交',exact:true}).click();
  for(const p of pages)await p.getByRole('dialog',{name:'战场播放器'}).waitFor({timeout:120000});
  const histories=[];
  for(let i=0;i<3;i++){
   await pages[i].getByRole('button',{name:'暂停',exact:true}).click();await pages[i].getByLabel('播放速度').selectOption(['0.25','1','4'][i]);
   await pages[i].getByLabel('播放进度').fill(String([15,70,140][i]));
   const result=await call(pages[i],{op:'replay',code:seats[i].code,token:seats[i].token,match:1,round});assert.equal(result.frames.length,900);assert.deepEqual(result.errors,[]);histories.push(result);
  }
  assert.deepEqual(histories[0],histories[1]);assert.deepEqual(histories[1],histories[2]);
  const times=await Promise.all(pages.map(p=>p.getByTestId('playback-time').innerText()));assert.equal(new Set(times).size,3);
  const scores=[];for(const p of pages){await p.getByLabel('播放进度').fill('180');scores.push(await p.locator('.scoreboard').innerText());await p.getByRole('button',{name:'关闭战场'}).click();}
  assert.equal(new Set(scores).size,1);rounds.push({round,elapsedMs:Date.now()-started,frames:900,scores:histories[0].final.players.map(p=>p.score),bases:histories[0].initial.players.map(p=>p.base)});
 }
 const final=await call(pages[0],{op:'sync',code:seats[0].code,token:seats[0].token});assert.equal(final.status,'finished');assert.equal(final.history.length,3);
 await pages[1].reload();await pages[1].getByRole('dialog',{name:'战场播放器'}).waitFor({timeout:30000});await pages[1].getByRole('button',{name:'关闭战场'}).click();await pages[1].getByRole('button',{name:'查看第 1 轮战报'}).click();await pages[1].getByRole('dialog',{name:'战场播放器'}).waitFor();await pages[1].getByRole('button',{name:'关闭战场'}).click();
 await pages[0].getByRole('button',{name:'原房间再赛'}).click();await pages[0].getByRole('region',{name:'赛程与复盘'}).getByRole('button',{name:'验证并提交',exact:true}).waitFor();
 assert.deepEqual(errors,[]);fs.writeFileSync('.qa/multiplayer-v04.json',JSON.stringify({url,rounds,identicalReplay:true,independentPlayback:true,refresh:true,rematch:true,errors},null,2));console.log(fs.readFileSync('.qa/multiplayer-v04.json','utf8'));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
