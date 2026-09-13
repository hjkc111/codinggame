const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),assert=require('assert/strict');fs.mkdirSync('.qa',{recursive:true});
const url=process.env.TEST_URL||'http://127.0.0.1:8787';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 const editor=page.getByLabel('策略代码',{exact:true});await editor.waitFor();
 const python=await editor.inputValue();assert(python.includes('def scout('));
 const dimensions=await editor.evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth,color:getComputedStyle(e).color,wrap:e.wrap}));assert(dimensions.width>1200);assert.equal(dimensions.wrap,'soft');assert.notEqual(dimensions.color,'rgba(0, 0, 0, 0)');
 await editor.fill('# '+ '中文abc'.repeat(300));assert.equal(await editor.evaluate(e=>e.scrollWidth),await editor.evaluate(e=>e.clientWidth));
 await editor.press('Control+End');await editor.press('Tab');assert((await editor.inputValue()).endsWith('    '));await editor.fill(python);
 await page.getByLabel('编辑器字号').selectOption('20');assert.equal(await editor.evaluate(e=>getComputedStyle(e).fontSize),'20px');await page.getByLabel('编辑器字号').selectOption('16');
 await page.screenshot({path:'.qa/workspace-v04.png',fullPage:true});
 await page.getByRole('button',{name:'打开战场',exact:true}).click();await page.getByRole('button',{name:'关闭战场'}).click();
 await page.getByRole('button',{name:'运行训练',exact:true}).click();
 await page.getByRole('dialog',{name:'战场播放器'}).waitFor({timeout:90000});
 assert(!(await page.locator('.player-inspector').innerText()).includes('Error'));
 await page.getByRole('button',{name:'暂停',exact:true}).click();const before=await page.getByTestId('playback-time').innerText();await page.waitForTimeout(500);assert.equal(await page.getByTestId('playback-time').innerText(),before);
 for(const v of ['0.25','0.5','1','2','4'])await page.getByLabel('播放速度').selectOption(v);
 await page.getByLabel('播放进度').fill('170');await page.getByRole('button',{name:'播放',exact:true}).click();await page.waitForTimeout(1000);const fast=await page.getByTestId('playback-time').innerText();assert(parseFloat(fast)>172);await page.getByRole('button',{name:'暂停',exact:true}).click();
 await page.getByLabel('播放进度').fill('180');await page.screenshot({path:'.qa/replay-v04.png',fullPage:true});
 const score=await page.locator('.scoreboard').innerText();assert(/\d/.test(score));
 await page.getByRole('button',{name:'关闭战场'}).click();await page.getByRole('button',{name:'打开战场',exact:true}).click();assert((await page.getByTestId('playback-time').innerText()).startsWith('180.0'));await page.getByRole('button',{name:'关闭战场'}).click();
 await page.getByLabel('编程语言').selectOption('javascript');await page.getByRole('button',{name:'运行训练',exact:true}).click();await page.getByRole('dialog',{name:'战场播放器'}).waitFor({timeout:60000});await page.getByRole('button',{name:'关闭战场'}).click();
 await page.getByLabel('编程语言').selectOption('python');
 await editor.fill('def decide(o,m):\n    while True: pass');await page.getByRole('button',{name:'运行训练',exact:true}).click();await page.getByRole('dialog',{name:'战场播放器'}).waitFor({timeout:60000});assert((await page.locator('.player-inspector').innerText()).includes('运行超时'));await page.getByRole('button',{name:'关闭战场'}).click();await editor.fill(python);
 await page.getByRole('button',{name:'自选手册',exact:true}).click();await page.getByRole('dialog',{name:'操作手册'}).waitFor();await page.getByRole('button',{name:'关闭手册'}).click();
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'.qa/mobile-v04.png',fullPage:true});
 assert.deepEqual(errors,[]);
 fs.writeFileSync('.qa/browser-v04.json',JSON.stringify({editor:dimensions,python:true,javascript:true,pause:true,speeds:true,seek:true,timeout:true,mobile:true,errors},null,2));console.log(fs.readFileSync('.qa/browser-v04.json','utf8'));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
