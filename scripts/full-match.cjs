const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs');fs.mkdirSync('.qa',{recursive:true});
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true});const pages=[];
 for(let i=0;i<3;i++){const c=await b.newContext({viewport:{width:1440,height:1050}});const p=await c.newPage();await p.goto((process.env.TEST_URL || 'http://localhost:5173/'));await p.waitForTimeout(700);pages.push(p);}
 await pages[0].getByRole('button',{name:/多人房间/}).click();await pages[0].getByLabel('你的昵称').fill('Alpha');await pages[0].getByRole('button',{name:'创建新房间'}).click();await pages[0].locator('.room-strip strong').waitFor();const code=await pages[0].locator('.room-strip strong').textContent();
 for(let i=1;i<3;i++){await pages[i].getByRole('button',{name:/多人房间/}).click();await pages[i].getByLabel('你的昵称').fill(i===1?'Bravo':'Charlie');await pages[i].getByLabel('六位房间码').fill(code);await pages[i].getByRole('button',{name:'加入房间',exact:false}).click();await pages[i].locator('.room-strip').waitFor();}
 await pages[0].getByText('3/4 人',{exact:true}).waitFor();await pages[0].getByRole('button',{name:'开始比赛',exact:true}).click();
 for(let i=0;i<3;i++){if(i===1)await pages[i].getByLabel('编程语言').selectOption('javascript');await pages[i].getByRole('button',{name:'运行策略',exact:false}).click();await pages[i].locator('.runtime-status').filter({hasText:i===1?'JavaScript 正在执行':'Python 正在执行'}).waitFor({timeout:60000});}
 console.log('Three real UI players running Python / JS / Python');
 await pages[0].waitForTimeout(8000);await pages[0].screenshot({path:'.qa/multiplayer.png',fullPage:true});
 await pages[2].reload();await pages[2].locator('.room-strip strong').waitFor();if(await pages[2].locator('.room-strip strong').textContent()!==code)throw Error('Seat restore failed');await pages[2].getByRole('button',{name:'运行策略',exact:false}).click();await pages[2].locator('.runtime-status').filter({hasText:'Python 正在执行'}).waitFor({timeout:60000});console.log('Refresh restored seat and resumed Python');
 for(let i=0;i<10;i++){if(await pages[0].locator('.result').count())break;await pages[0].waitForTimeout(18000);console.log('Match time',await pages[0].locator('.match-time').textContent());}
 await pages[0].locator('.result').waitFor({timeout:15000});await pages[2].waitForTimeout(1200);
 const scores=await Promise.all(pages.map(p=>p.locator('.scoreboard').innerText()));if(new Set(scores).size!==1)throw Error('Final scores differ');
 fs.writeFileSync('.qa/full-match-results.json',JSON.stringify({uiPlayers:3,languages:['Python','JavaScript','Python'],refreshResume:true,completed:true,scores:scores[0]},null,2));console.log('Full three-minute match complete, identical final scores');await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
