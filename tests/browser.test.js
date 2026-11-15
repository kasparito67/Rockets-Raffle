import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
test('mobile form, closed reservations, pending recovery, truthful mail result and double-click guard',async()=>{
 const server=createServer(async(req,res)=>{
  try{const html=await readFile(req.url==='/rockets_logo_small.png'?'rockets_logo_small.png':'index.html');res.end(html)}catch{res.statusCode=404;res.end()}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let open=false,posts=[],fail=true;
 await page.route('**/api/config',r=>r.fulfill({json:{reservationsOpen:open}}));
 await page.route('**/api/reservations',async r=>{
  if(r.request().method()==='GET')return r.fulfill({json:[]});
  posts.push(r.request().postDataJSON());
  if(fail)return r.abort();
  await new Promise(resolve=>setTimeout(resolve,150));
  return r.fulfill({status:201,json:{ok:true,emailStatus:'failed',emailSent:false}});
 });
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.waitForFunction(()=>document.querySelector('#grid').children.length===200);
 assert.equal(await page.locator('#continue').isDisabled(),true);
 open=true;await page.reload();await page.waitForFunction(()=>!document.querySelector('.number').disabled);
 await page.selectOption('#players','Noah Caspar');await page.locator('.number').first().click();
 await page.fill('#buyerName','Parent Test');await page.fill('#buyerEmail','parent@example.com');
 await page.click('#continue');await page.getByRole('button',{name:'Vérifier ma réservation'}).waitFor();
 const requestId=posts[0].requestId;await page.reload();await page.getByRole('button',{name:'Vérifier ma réservation'}).waitFor();
 assert.equal(await page.inputValue('#buyerEmail'),'parent@example.com');
 fail=false;await page.click('#continue');assert.equal(await page.locator('#continue').isDisabled(),true);
 await page.getByRole('heading',{name:'Réservation enregistrée'}).waitFor();
 assert.equal(posts.length,2);assert.equal(posts[1].requestId,requestId);
 assert.match(await page.locator('#formMessage').textContent(),/envoi du courriel reste à vérifier/);
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('rocketPendingRequest')),null);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r))}
});
