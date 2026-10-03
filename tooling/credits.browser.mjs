import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,extname,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const root=process.cwd(),shots=join(root,'tooling/audit/credits');
mkdirSync(shots,{recursive:true});
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2','.xml':'application/xml','.json':'application/json','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 let file=resolve(root,'public',pathname.replace(/^\/bluenote\//,''));
 if(file!==join(root,'public')&&!file.startsWith(join(root,'public')+'/')){res.writeHead(404);res.end();return;}
 if(existsSync(file)&&statSync(file).isDirectory())file=join(file,'index.html');
 if(!existsSync(file)){res.writeHead(404);res.end();return;}
 let data=readFileSync(file);
 if(extname(file)==='.html')data=Buffer.from(data.toString().replace(/<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">/,''));
 res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream'});res.end(data);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=process.env.BLUE_NOTE_ORIGIN||'http://127.0.0.1:'+server.address().port;
const paths=['','archives/','gallery/','gallery/all/','about/','2026/08/27/Z.A.T.O-随想/','2026/09/27/小蓝本/','design/','tags/','404.html'];
const builtHome=readFileSync(join(root,'public/index.html'),'utf8');
const publicCount=(builtHome.match(/<li class="letterbox-entry">/g)||[]).length;
const totalCount=(builtHome.match(/<li class="letterbox-entry"/g)||[]).length;
const results=[],errors=[];
const box=async(p,s)=>p.locator(s).evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
async function checkCreditsAxis(p) {
 const problems=await p.evaluate(()=>{
  const axis=document.documentElement.clientWidth/2,problems=[];
  document.querySelectorAll('.letterbox-year__title,.letterbox-entry__title').forEach(e=>{
   if(!e.getClientRects().length)return;
   const r=e.getBoundingClientRect();
   if(Math.abs(r.x+r.width/2-axis)>0.75)problems.push(e.textContent+' is off the page axis');
   if(e.matches('.letterbox-entry__title')){
    const range=document.createRange();range.selectNode(e.firstChild);
    for(const line of range.getClientRects())if(Math.abs(line.x+line.width/2-axis)>1)problems.push(e.textContent+' has an off-centre text line');
    const lock=e.querySelector('.private-link-lock');
    if(lock){const icon=lock.getBoundingClientRect(),row=e.closest('a').getBoundingClientRect();
     if(icon.left<r.right||icon.right>row.right)problems.push('Lock overlaps title or escapes row');
    }
   }
  });return problems;
 });
 assert.deepEqual(problems,[]);
}
try{
for(const [engine,browserType] of (process.env.BLUE_NOTE_ENGINE==='webkit'?[['webkit',webkit]]:[['chromium',chromium],['webkit',webkit]])){
 const browser=await browserType.launch();
 try{
 for(const [w,h] of (process.env.BLUE_NOTE_OVERLAYS_ONLY?[]:[[320,740],[390,844],[768,1024],[1024,600],[1440,900],[844,390]].filter(v=>!process.env.BLUE_NOTE_WIDTH||v[0]===Number(process.env.BLUE_NOTE_WIDTH)))){
 for(const scheme of ['light','dark']){
  let baseline,titleY;
  const p=await browser.newPage({viewport:{width:w,height:h},colorScheme:scheme});
  p.on('pageerror',e=>errors.push(e.message));
  for(const path of paths){
   await p.goto(origin+'/bluenote/'+path);await p.evaluate(()=>document.fonts.ready);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await p.waitForTimeout(150);
   const nav=await box(p,'.site-nav'),brand=await box(p,'.site-nav__brand');
   const dockFixed=await p.evaluate(()=>matchMedia('(min-width: 768px) and (min-height: 521px)').matches);
   assert.equal(nav.y,0);assert.equal(nav.h,dockFixed?88:64,`${engine} ${w} ${path}: initial navigation height`);
   assert.equal(await p.locator('.site-nav').evaluate(e=>getComputedStyle(e).position),'fixed');
   if(baseline)assert.deepEqual({nav,brand},baseline,`${engine} ${w} ${path} chrome differs`);else baseline={nav,brand};
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${path} overflows ${w}`);
   if(!['','404.html'].includes(path)){
    const title=await box(p,'.masthead__title');
    if(titleY!==undefined)assert(Math.abs(title.y-titleY)<1,`${path} title baseline changed at ${w}`);else titleY=title.y;
    assert.equal(await p.locator('.masthead__inner').evaluate(e=>getComputedStyle(e,'::after').content),'none');
   }
   for(const delta of [650,-90,1e6,-1e6]){
    await p.mouse.wheel(0,delta);await p.waitForTimeout(65);
    assert.deepEqual(await box(p,'.site-nav'),nav,`${engine} ${w} ${path} nav moved`);
    assert.deepEqual(await box(p,'.site-nav__brand'),brand,`${path} brand moved`);
   }
   if(path===''){
    assert.equal(await p.locator('.letterbox-entry:visible').count(),publicCount);
    assert.equal(await p.locator('[data-private-entry]:visible').count(),0);
    assert.equal(await p.locator('[data-private-year]:visible').count(),0);
    await p.evaluate(()=>scrollTo(0,document.querySelector('.letterbox-frame').offsetHeight));
    const dock=await box(p,'.letterbox-dock');
    if(dockFixed){
     assert.equal(dock.y,h-nav.h);await p.locator('.letterbox-entry__link').first().hover();await p.waitForTimeout(250);
     assert.deepEqual(await box(p,'.letterbox-dock'),dock);
     assert.equal((await p.locator('.letterbox-dock').innerText()).trim(),await p.locator('.letterbox-entry__link').first().getAttribute('data-excerpt'));
    }
    await p.screenshot({path:join(shots,`${engine}-${w}-${h}-${scheme}-index.png`)});
    await p.locator('.letterbox-entry[data-private-entry] .private-link-lock').first().waitFor({state:'attached'});
    await p.evaluate(()=>document.documentElement.classList.add('private-reading-unlocked'));
    await checkCreditsAxis(p);
    const undated=p.locator('.letterbox-entry__link[data-private-link="eeddfa74ef298a0c"]');
    assert.equal(await undated.locator('time').innerText(),'');
    await undated.scrollIntoViewIfNeeded();
    await p.screenshot({path:join(shots,`${engine}-${w}-${h}-${scheme}-axis.png`)});
    await p.evaluate(()=>document.documentElement.classList.remove('private-reading-unlocked'));
   }
   if(path==='archives/'){
    const row=p.locator('[data-private-link="eeddfa74ef298a0c"]');
    assert.equal(await row.locator('time').innerText(),'');assert.equal(await row.locator('.listing__note').count(),0);
    await p.screenshot({path:join(shots,`${engine}-${w}-${h}-${scheme}-archives.png`),fullPage:true});
   }
   if(path==='about/'&&w<992){
    await p.evaluate(()=>scrollTo(0,80));const y=await p.evaluate(()=>scrollY);
    const contentBefore=await box(p,'.page-body');
    await p.locator('.site-nav__toggle').click();assert.equal(await p.locator('.site-nav__toggle').getAttribute('aria-expanded'),'true');
    assert.deepEqual(await box(p,'.site-nav'),nav);await p.mouse.wheel(0,200);await p.waitForTimeout(100);assert.deepEqual(await box(p,'.page-body'),contentBefore);await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>scrollY),y);
    assert(await p.locator('.site-nav__toggle').evaluate(e=>e===document.activeElement));
    await p.locator('.site-nav__toggle').click();await p.locator('a[href="#site-search"]').click();
    await p.locator('.site-search-dialog__field input').waitFor({state:'visible'});await p.keyboard.press('Escape');
    assert.equal(await p.evaluate(()=>scrollY),y);assert(await p.locator('.site-nav__toggle').evaluate(e=>e===document.activeElement));
   }
  }
  results.push(`${engine} ${w}×${h} ${scheme}: ${paths.length} pages, fixed navigation and shared title baseline, no overflow`);
  await p.close();
 }
 }
 // Real overlay controls preserve the exact background and reading position.
 for(const width of [390,1440]){
  const p=await browser.newPage({viewport:{width,height:844}});
  for(const [path,trigger,close] of [
   ['gallery/','[data-gallery-open]','[data-gallery-close]'],
   ['2023/11/19/秋之纽约-2023-11/','.markdown-body img','[data-lightbox-close]'],
   ['2026/09/27/小蓝本/','[data-private-unlock]','[data-private-close]']
  ]){
   await p.goto(origin+'/bluenote/'+path);await p.evaluate(()=>document.fonts.ready);
   const button=p.locator(trigger).first();await button.scrollIntoViewIfNeeded();await p.waitForTimeout(100);
   const before=await box(p,'.page-body'),nav=await box(p,'.site-nav'),y=await p.evaluate(()=>scrollY);
   await button.click();await p.locator(close).waitFor({state:'visible'});await p.mouse.wheel(0,220);await p.waitForTimeout(100);
   assert.deepEqual(await box(p,'.page-body'),before,`${engine} ${path} background moved`);
   assert.deepEqual(await box(p,'.site-nav'),nav,`${engine} ${path} bar moved`);
   await p.locator(close).click();await p.waitForTimeout(100);
   assert.equal(await p.evaluate(()=>scrollY),y,`${engine} ${path} reading position lost`);
  }
  await p.close();
 }
 results.push(`${engine}: Gallery, article images and private unlock overlays freeze and restore the background`);
 // Long/future lists, natural wrapping, private metadata visibility and text zoom.
 const p=await browser.newPage({viewport:{width:390,height:844}});await p.goto(origin+'/bluenote/');
 await p.evaluate(()=>{const list=document.querySelector('.letterbox-year__list'),entry=list.firstElementChild;
  for(let i=0;i<45;i++){const clone=entry.cloneNode(true);clone.querySelector('.letterbox-entry__title').textContent='长标题与英文 LongUnbrokenTitle'.repeat(4)+i;list.appendChild(clone);}
 });
 assert.equal(await p.locator('.letterbox-entry:visible').count(),publicCount+45);
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.addStyleTag({content:'html{font-size:200%}'});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.locator('.letterbox-entry:visible').last().scrollIntoViewIfNeeded();assert(await p.locator('.letterbox-entry:visible').last().evaluate(e=>{const r=e.getBoundingClientRect();return r.bottom>64&&r.top<innerHeight;}));
 await p.evaluate(()=>document.documentElement.classList.add('private-reading-unlocked'));assert.equal(await p.locator('.letterbox-entry:visible').count(),totalCount+45);
 await checkCreditsAxis(p);
 await p.close();
 const n=await browser.newPage({javaScriptEnabled:false,viewport:{width:390,height:844}});await n.goto(origin+'/bluenote/');
 assert.equal(await n.locator('.letterbox-entry:visible').count(),publicCount);assert(await n.locator('.letterbox-dock').isVisible());await n.close();
 results.push(`${engine}: 45 extra long entries, 200% text, privacy gating and no-script fallback`);
 }finally{await browser.close();}
}
assert.deepEqual(errors,[]);
writeFileSync(join(shots,'results.json'),JSON.stringify({results,errors},null,2));console.log(results.join('\n'));
}finally{server.close();}
