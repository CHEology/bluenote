// Local browser audit. No CI or external telemetry.
import { chromium, webkit } from 'playwright';
import { readFileSync, readdirSync, existsSync, statSync, createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createGzip } from 'node:zlib';
import { join, resolve, extname, sep, relative } from 'node:path';
const base=resolve('public'),root='/bluenote/';
const output=resolve('tooling/audit');mkdirSync(output,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.xml':'application/xml','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'};
const server=createServer((req,res)=>{
  let p;try{p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
  if(!p.startsWith(root)){res.writeHead(404);res.end();return;}
  let file=resolve(base,p.slice(root.length));
  if(file!==base&&!file.startsWith(base+sep)){res.writeHead(404);res.end();return;}
  if(existsSync(file)&&statSync(file).isDirectory())file=join(file,'index.html');
  if(!existsSync(file)){res.writeHead(404);res.end();return;}
  const type=mime[extname(file)]||'application/octet-stream',gzip=/text|json|xml|svg/.test(type)&&String(req.headers['accept-encoding']).includes('gzip');
  res.writeHead(200,{'content-type':type,...(gzip?{'content-encoding':'gzip'}:{})});
  if(extname(file)==='.html'){
      // WebKit upgrades loopback HTTP resources to HTTPS; production HTML keeps this policy.
      const html=readFileSync(file,'utf8').replace(/<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">/g,'');
      if(gzip){const z=createGzip();z.pipe(res);z.end(html);}else res.end(html);
      return;
    }
    const stream=createReadStream(file);if(gzip)stream.pipe(createGzip()).pipe(res);else stream.pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const pages=walk(base).filter(f=>f.endsWith('.html')).map(f=>relative(base,f).replace(/index.html$/,''));
const results=[];
try{
 for(const engine of [chromium,webkit]){
  const browser=await engine.launch();
  try{
   for(const [width,height] of [[320,740],[390,844],[768,1024],[1024,768],[1440,900]]){
    for(const scheme of ['light','dark']){
     const context=await browser.newContext({viewport:{width,height},colorScheme:scheme,deviceScaleFactor:1,isMobile:width<768,hasTouch:width<768});
     const page=await context.newPage();let errors=[],requests=[];
     page.on('pageerror',e=>errors.push(e.message));
     page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
     page.on('requestfailed',r=>{if(!/aborted|cancelled|canceled/i.test(r.failure()?.errorText||''))errors.push(r.failure()?.errorText+' '+r.url());});
     page.on('request',r=>requests.push(r.url()));
     for(const path of pages){
      errors=[];requests=[];
      await page.goto(origin+root+path,{waitUntil:'networkidle'});
      const info=await page.evaluate(()=>{
       const isVisible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};
       return {
        overflow:document.documentElement.scrollWidth>innerWidth,
        brokenVisibleImages:[...document.images].filter(e=>isVisible(e)&&e.getBoundingClientRect().top<innerHeight&&e.getBoundingClientRect().bottom>0&&e.complete&&!e.naturalWidth).map(e=>e.currentSrc||e.src),
        wideElements:[...document.querySelectorAll('.markdown-body > *, .literary-panel, .gallery-row')].filter(e=>isVisible(e)&&e.getBoundingClientRect().right>innerWidth+1).map(e=>e.tagName+'.'+e.className),
        fontSize:document.querySelector('.markdown-body')?getComputedStyle(document.querySelector('.markdown-body')).fontSize:null,
        lang:document.documentElement.lang
       };
      });
      const external=requests.filter(url=>!url.startsWith(origin)&&!url.startsWith('data:'));
      results.push({browser:engine.name(),width,height,scheme,path,...info,errors:[...errors],external});
     }
     await context.close();console.log(engine.name()+' '+width+' '+scheme+': '+pages.length+' pages');
    }
   }
  }finally{await browser.close();}
 }
}finally{await new Promise(r=>server.close(r));}
const failures=results.filter(r=>r.overflow||r.brokenVisibleImages.length||r.wideElements.length||r.errors.length||r.external.length);
writeFileSync(join(output,'browser.json'),JSON.stringify({at:new Date().toISOString(),pages:pages.length,checks:results.length,failures,results},null,2));
console.log(JSON.stringify({pages:pages.length,checks:results.length,failures:failures.map(({browser,width,scheme,path,overflow,wideElements,errors})=>({browser,width,scheme,path,overflow,wideElements,errors}))},null,2));
process.exitCode=failures.length?1:0;
