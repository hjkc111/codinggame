const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),assert=require('assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();await page.goto(process.env.TEST_URL||'http://127.0.0.1:8787');
  await page.getByRole('button',{name:'运行训练',exact:true}).click();await page.getByRole('dialog',{name:'战场播放器'}).waitFor({timeout:90000});
  const samples=[];
  for(const speed of ['0.25','1','4']){
   await page.getByLabel('播放进度').fill('15');await page.getByLabel('播放速度').selectOption(speed);
   const value=await page.evaluate(()=>new Promise(resolve=>{const times=[],start=performance.now();let last=start;function next(now){times.push(now-last);last=now;if(now-start>=3000){times.sort((a,b)=>a-b);resolve({fps:Math.round(times.length*1000/(now-start)),p95Ms:times[Math.floor(times.length*.95)],frames:times.length});}else requestAnimationFrame(next);}requestAnimationFrame(next);}));samples.push({speed,...value});
  }
  await context.setOffline(true);const before=parseFloat(await page.getByTestId('playback-time').innerText());await page.waitForTimeout(1000);const after=parseFloat(await page.getByTestId('playback-time').innerText());assert(after>before+2);await page.getByLabel('播放进度').fill('180');assert((await page.getByTestId('playback-time').innerText()).startsWith('180.0'));
  fs.writeFileSync('.qa/performance-v04.json',JSON.stringify({samples,offlinePlayback:true,environment:'Local Chrome headless; not a guarantee for every device'},null,2));console.log(fs.readFileSync('.qa/performance-v04.json','utf8'));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
