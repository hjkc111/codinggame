const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs');fs.mkdirSync('.qa',{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),pages=[],errors=[];
 for(let i=0;i<3;i++){const c=await browser.newContext({viewport:{width:1440,height:1100}});const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.TEST_URL||'http://localhost:5173/');pages.push(p);}
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
   if(round===1){await pages[0].waitForTimeout(5000);await pages[2].reload();await pages[2].locator('.room-strip strong').waitFor();if(await pages[2].locator('.room-strip strong').textContent()!==code)throw Error('Seat restore failed');await pages[2].getByRole('button',{name:'运行策略',exact:false}).click();await pages[2].locator('.runtime-status').filter({hasText:'Python 正在执行'}).waitFor({timeout:60000});}
   for(let i=0;i<20;i++){if(await pages[0].locator('.round-review summary').filter({hasText:`第 ${round} 轮复盘`}).count())break;await pages[0].waitForTimeout(10000);if(i%3===0)console.log(`Round ${round}`,await pages[0].locator('.match-time').textContent());}
   await pages[0].locator('.round-review summary').filter({hasText:`第 ${round} 轮复盘`}).waitFor({timeout:15000});await pages[0].waitForTimeout(1400);
   const scores=await Promise.all(pages.map(p=>p.locator('.scoreboard').innerText()));if(new Set(scores).size!==1)throw Error('Final scores differ');
   const delivered=await pages[0].locator('.round-review tbody tr td:nth-child(3)').allTextContents();if(delivered.some(v=>Number(v)<=0))throw Error('A strategy failed to score this round');
   const table=await pages[0].locator('.round-review table').innerText();if(!/\d/.test(table))throw Error('Missing round statistics');
   for(let i=0;i<3;i++)if(await pages[i].getByLabel('策略代码编辑器').inputValue()!==drafts[i])throw Error('Draft lost between rounds');
   snapshots.push({round,scores:scores[0],table});await pages[0].screenshot({path:`.qa/series-round-${round}.png`,fullPage:true});
   if(round===2){await pages[0].setViewportSize({width:390,height:844});if(await pages[0].evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Series mobile overflow');await pages[0].screenshot({path:'.qa/series-mobile.png',fullPage:true});await pages[0].setViewportSize({width:1440,height:1100});}
 }
 await pages[0].getByRole('button',{name:'原房间再赛'}).click();await pages[0].getByRole('button',{name:'验证并准备',exact:true}).waitFor();if(await pages[0].locator('.round-review').count())throw Error('Rematch retained history');if(await pages[0].getByLabel('策略代码编辑器').inputValue()!==drafts[0])throw Error('Rematch lost code');
 if(errors.length)throw Error(errors.join('\n'));fs.writeFileSync('.qa/full-match-results.json',JSON.stringify({rounds:3,secondsPerRound:180,uiPlayers:3,languages:['Python','JavaScript','Python'],refreshResume:true,editCancelsReady:true,codeRetained:true,rematch:true,errors,snapshots},null,2));console.log('Full three-round series passed');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
