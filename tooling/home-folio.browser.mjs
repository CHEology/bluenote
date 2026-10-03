import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,extname} from 'node:path';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const engine=process.env.BLUE_NOTE_ENGINE==='webkit'?webkit:chromium;
const root=process.cwd(),baseline=process.env.BLUE_NOTE_BASELINE||join(root,'tooling/visual/home-baseline');
assert(existsSync(join(baseline,'index.html')),'Set BLUE_NOTE_BASELINE to the previous production public/ directory before running mobile comparisons.');
const shots=join(root,'tooling/audit/home-folio'+(process.env.BLUE_NOTE_ENGINE==='webkit'?'-webkit':''));mkdirSync(shots,{recursive:true});
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2','.xml':'application/xml','.json':'application/json'};
const server=createServer((req,res)=>{
 let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),base=path.startsWith('/baseline/')?baseline:join(root,'public');
 path=path.replace(/^\/baseline/,'').replace(/^\/bluenote\//,'');
 let file=join(base,path);if(existsSync(file)&&statSync(file).isDirectory())file=join(file,'index.html');
 if(!existsSync(file)){res.writeHead(404);res.end();return;}
 let data=readFileSync(file);
 // Production is HTTPS; local WebKit fixtures must not upgrade loopback asset URLs.
 if(extname(file)==='.html')data=Buffer.from(data.toString().replace(/<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">/,''));
 if(req.url.startsWith('/baseline/')&&extname(file)==='.html')data=Buffer.from(data.toString().replaceAll('"/bluenote/','"/baseline/bluenote/').replaceAll("'/bluenote/","'/baseline/bluenote/"));
 res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream'});res.end(data);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,browser=await engine.launch(process.env.BLUE_NOTE_CHROMIUM&&engine===chromium?{executablePath:process.env.BLUE_NOTE_CHROMIUM}:{});
const results=[],errors=[];
async function open(width,height,opts={}){const p=await browser.newPage({viewport:{width,height},...opts});p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/bluenote/');await p.evaluate(()=>document.fonts.ready);await p.evaluate(()=>scrollTo(0,document.querySelector('.home-cover').offsetHeight));await p.waitForTimeout(500);return p;}
async function visible(p){return p.locator('.home-folio-column:not([hidden])').evaluateAll(cols=>cols.map(c=>({page:c.dataset.page,articles:[...c.querySelectorAll('h2 a')].map(a=>a.textContent.trim())})));}
async function future(p,count=23){await p.route('**/bluenote/',async route=>{const response=await route.fetch();let html=await response.text();const template=html.match(/<template id="home-folio-source">([\s\S]*?)<\/template>/)[1];const example=template.match(/<article class="home-folio-entry">[\s\S]*?<\/article>/)[0];const entries=Array.from({length:count},(_,i)=>example.replace(/<span>[\s\S]*?<\/span>/,'<span>试验文章 '+(i+1)+'</span>').replace(/title="[^"]+"/,'title="试验文章 '+(i+1)+'"')).join('');html=html.replace(/(<template id="home-folio-source">)[\s\S]*?(<\/template>)/,'$1'+entries+'$2');await route.fulfill({response,body:html});});await p.reload();await p.evaluate(()=>document.fonts.ready);await p.evaluate(()=>scrollTo(0,document.querySelector('.home-cover').offsetHeight));await p.waitForTimeout(100);}
try{
 for(const [w,h] of [[(engine===webkit?800:768),500],[800,600],[1024,600],[1280,720],[1366,768],[1280,900],[1920,1080],[2560,1440]]){
  const p=await open(w,h);
  const geometry=await p.evaluate(()=>{
   const cols=[...document.querySelectorAll('.home-folio-column:not([hidden])')],entries=cols.flatMap(c=>[...c.children]),pager=document.querySelector('.home-folio-pagination').getBoundingClientRect();
   const rects=entries.map(e=>e.getBoundingClientRect());
   return {scroll:scrollY,coverHeight:document.querySelector('.home-cover').offsetHeight,mainY:document.querySelector('.home-main').getBoundingClientRect().top,opacity:getComputedStyle(document.querySelector('.home-folio')).opacity,counts:cols.map(c=>c.children.length),top:Math.min(...rects.map(r=>r.top)),bottom:Math.max(...rects.map(r=>r.bottom)),pagerTop:pager.top,pagerBottom:pager.bottom,h:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,
    spill:entries.some(e=>[...e.children].filter(c=>getComputedStyle(c).display!=='none').some(c=>{let a=e.getBoundingClientRect(),b=c.getBoundingClientRect();return b.top<a.top-1||b.bottom>a.bottom+1||b.left<a.left-1||b.right>a.right+1;}))};
  });
  await p.screenshot({path:join(shots,`desktop-${w}-${h}.png`)});assert.deepEqual(geometry.counts,[5,5]);assert(!geometry.overflow&&!geometry.spill,JSON.stringify({w,h,geometry}));assert(geometry.top>=15,JSON.stringify({w,h,geometry}));assert(geometry.bottom<geometry.pagerTop-10);assert(geometry.pagerBottom<=h-12,JSON.stringify({w,h,geometry}));
  assert.equal(await p.locator('.home-folio-pagination [aria-current]').count(),2);
  results.push(`${w}×${h}: five rows, two columns, page strip fits with space`);await p.close();
 }
 const p=await open(1280,900);await future(p);
 const first=await visible(p);assert.deepEqual(first.map(c=>c.page),['1','2']);
 await p.getByRole('button',{name:'Next column'}).click();await p.waitForTimeout(220);await p.screenshot({path:join(shots,'turn-middle.png')});await p.waitForTimeout(400);
 let second=await visible(p);assert.deepEqual(second.map(c=>c.page),['2','3']);assert.deepEqual(first[1].articles,second[0].articles);assert.deepEqual(second[1].articles,['试验文章 11','试验文章 12','试验文章 13','试验文章 14','试验文章 15']);assert.equal(await p.locator('[aria-current="page"][data-folio-page]').count(),2);
 await p.screenshot({path:join(shots,'pages-2-3.png')});
 await p.getByRole('button',{name:'Previous column'}).click();await p.waitForTimeout(550);assert.deepEqual(await visible(p),first);
 await p.locator('[data-folio-page="5"]').click();await p.waitForTimeout(500);assert.deepEqual((await visible(p)).map(c=>c.page),['4','5']);assert.equal((await visible(p))[1].articles.length,3);assert(await p.getByRole('button',{name:'Next column'}).isDisabled());await p.screenshot({path:join(shots,'last-page.png')});
 await p.goBack();await p.waitForTimeout(100);assert.deepEqual((await visible(p)).map(c=>c.page),['1','2']);
 await p.evaluate(()=>{const next=document.querySelector('[data-folio-step="1"]');for(let i=0;i<8;i++)next.click();});await p.waitForTimeout(600);assert.deepEqual((await visible(p)).map(c=>c.page),['2','3']);
 await p.getByRole('button',{name:'Next column'}).click();await p.waitForTimeout(180);await p.setViewportSize({width:800,height:600});await p.waitForTimeout(400);assert.equal(await p.locator('.home-folio-column:not([hidden])').count(),2);
 await p.emulateMedia({reducedMotion:'reduce'});await p.getByRole('button',{name:'Previous column'}).click();assert.deepEqual((await visible(p)).map(c=>c.page),['1','2']);
 await p.addStyleTag({content:'html{font-size:200%}'});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert(await p.locator('.home-folio-column:not([hidden]) .home-folio-entry').evaluateAll(entries=>entries.every(e=>[...e.children].filter(c=>getComputedStyle(c).display!=='none').every(c=>c.getBoundingClientRect().bottom<=e.getBoundingClientRect().bottom+1))));await p.close();results.push('23-entry fixture: one-column forward/backward, paired highlights, partial final page, history, rapid clicks, resize cancellation, reduced motion, 200% text');
 for(const w of [320,390,767]){
  const a=await browser.newPage({viewport:{width:w,height:844},isMobile:true,hasTouch:true});const b=await browser.newPage({viewport:{width:w,height:844},isMobile:true,hasTouch:true});
  await a.goto(origin+'/baseline/bluenote/');await b.goto(origin+'/bluenote/');
  for(const ratio of [0,1]){for(const q of [a,b]){await q.evaluate(r=>scrollTo(0,document.querySelector('.home-cover').offsetHeight*r),ratio);await q.waitForTimeout(350);}assert((await a.screenshot()).equals(await b.screenshot()),`phone ${w} changed at ${ratio}`);}
  await a.close();await b.close();results.push(`${w}px mobile pixel-identical to production`);
 }
 const q=await open(1280,900);await q.evaluate(()=>document.documentElement.classList.add('private-reading-unlocked'));await q.waitForTimeout(100);assert.equal(await q.locator('.home-folio-column').count(),3);await q.getByRole('button',{name:'Next column'}).click();await q.waitForTimeout(550);assert.equal(await q.locator('.home-folio-column:not([hidden])').count(),2);await q.evaluate(()=>document.documentElement.classList.remove('private-reading-unlocked'));await q.waitForTimeout(100);assert.equal(await q.locator('.home-folio-column').count(),2);assert.equal(await q.locator('.home-folio-column [data-private-entry]').count(),0);await q.close();results.push('Private metadata respects existing unlock state, no holes or private bodies');
 const r=await open(1280,900,{javaScriptEnabled:false});assert.equal(await r.locator('.home-folio-column').count(),2);assert(await r.locator('.home-folio-title a').first().isVisible());await r.close();
 assert.deepEqual(errors,[]);writeFileSync(join(shots,'results.json'),JSON.stringify({passed:results.length,results},null,2));console.log(JSON.stringify({passed:results.length,results},null,2));
}finally{await browser.close();server.close();}
