import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import handler from '../api/reservations.js';
import {sendReservationEmail} from '../lib/email.js';
import {processEmails} from '../lib/outbox.js';
const pg=new PGlite();
const id='00000000-0000-4000-8000-000000000001';
const input={requestId:id,numbers:[1,2],player:'Noah Caspar',name:'Parent Test',email:'parent@example.com'};
let gmailMode='ok',sent=[],failStatusWrite=false,originalFetch=global.fetch;
before(async()=>{
 await pg.exec('create role anon; create role authenticated; create role service_role;');
 await pg.exec(await readFile('supabase/schema.sql','utf8'));
 await pg.exec(await readFile('supabase/email-migration.sql','utf8'));
 // Reapplying the additive migration preserves data and schema.
 await pg.exec(await readFile('supabase/email-migration.sql','utf8'));
 Object.assign(process.env,{SUPABASE_URL:'https://database.test',SUPABASE_SERVICE_ROLE_KEY:'test',SUPABASE_ANON_KEY:'test',RAFFLE_LIVE_ENABLED:'true',PAYMENT_DETAILS_CONFIRMED:'true',INTERAC_EMAIL:'payment@example.com',GMAIL_ACCOUNT_CONFIRMED:'true',GMAIL_CLIENT_ID:'test',GMAIL_CLIENT_SECRET:'test',GMAIL_REFRESH_TOKEN:'test',GMAIL_SENDER_EMAIL:'rocketsdunord.m11bb.tirage@gmail.com',RAFFLE_ADMIN_EMAIL:'admin@example.com'});
 global.fetch=async(url,options={})=>{
  if(url.includes('oauth2.googleapis'))return Response.json({access_token:'test'});
  if(url.includes('gmail.googleapis')){
   if(gmailMode==='reject')return new Response('',{status:403});
   if(gmailMode==='timeout')throw Error('network lost');
   sent.push(Buffer.from(JSON.parse(options.body).raw,'base64url').toString());return Response.json({id:'fake-message'});
  }
  const path=url.split('/rest/v1/')[1],b=options.body?JSON.parse(options.body):null;
  try{
   let rows;
   if(path==='rpc/reserve_with_emails')await pg.query('select reserve_with_emails($1,$2,$3,$4,$5)',[b.p_id,b.p_numbers,b.p_player,b.p_name,b.p_email]);
   else if(path==='rpc/claim_reservation_emails')rows=(await pg.query('select * from claim_reservation_emails($1)',[b.p_id])).rows;
   else if(path.startsWith('reservation_groups?'))rows=(await pg.query('select * from reservation_groups where id=$1',[path.match(/id=eq\.([^&]+)/)[1]])).rows;
   else if(options.method==='PATCH' && failStatusWrite)throw Error('status persistence unavailable');
   else if(options.method==='PATCH')await pg.query('update reservation_emails set status=$1,last_error=$2 where group_id=$3 and audience=$4',[b.status,b.last_error,path.match(/group_id=eq\.([^&]+)/)[1],path.match(/audience=eq\.([^&]+)/)[1]]);
   else if(path.startsWith('reservation_emails?'))rows=(await pg.query("select status from reservation_emails where group_id=$1 and audience='buyer'",[path.match(/group_id=eq\.([^&]+)/)[1]])).rows;
   else throw Error('Unexpected path '+path);
   return rows?Response.json(rows):new Response('',{status:200});
  }catch(e){return new Response(e.code==='23505'?'23505':e.message,{status:e.code==='23505'?409:500})}
 };
});
after(async()=>{global.fetch=originalFetch;await pg.close()});
async function post(body){const res={setHeader(){},status(n){this.code=n;return this},json(data){this.data=data;return this}};await handler({method:'POST',body},res);return res}
test('reject invalid mailbox before reserving',async()=>{
 const r=await post({...input,email:'a@example.com,b@example.com'});assert.equal(r.code,400);assert.equal(sent.length,0);
});
test('reserve all numbers and notify buyer and organizer; replay sends neither twice',async()=>{
 const r=await post(input);assert.equal(r.code,201);assert.equal(r.data.emailStatus,'accepted');assert.equal(sent.length,2);
 assert.equal((await pg.query('select * from reservations')).rows.length,2);
 const replay=await post(input);assert.equal(replay.code,201);assert.equal(sent.length,2);
 const mime=sent[0];const html=Buffer.from(mime.split('\r\n\r\n')[1],'base64').toString();assert.match(html,/20 \$/);assert.match(html,/40 \$/);
});
test('competing request loses atomically; no notification for failure',async()=>{
 const r=await post({...input,requestId:'00000000-0000-4000-8000-000000000002',numbers:[2,3]});assert.equal(r.code,409);assert.equal(sent.length,2);
 assert.equal((await pg.query('select * from reservations where number=3')).rows.length,0);
});
test('same request cannot be reused with changed coordinates',async()=>assert.equal((await post({...input,name:'Changed'})).code,409));
test('Gmail failure preserves reservation, admin retry sends only failed jobs',async()=>{
 gmailMode='reject';const group='00000000-0000-4000-8000-000000000003';const r=await post({...input,requestId:group,numbers:[3]});assert.equal(r.code,201);assert.equal(r.data.emailSent,false);
 assert.equal((await pg.query('select * from reservations where number=3')).rows.length,1);
 gmailMode='ok';await processEmails(group);assert.equal(sent.length,4);await processEmails(group);assert.equal(sent.length,4);
});
test('unknown Gmail outcome is never resent automatically',async()=>{
 gmailMode='timeout';const group='00000000-0000-4000-8000-000000000004';assert.equal((await post({...input,requestId:group,numbers:[4]})).data.emailStatus,'unknown');
 gmailMode='ok';await processEmails(group);assert.equal(sent.length,4);
});
test('missing Gmail configuration keeps reservation; released group cannot be sent',async()=>{
 delete process.env.GMAIL_CLIENT_ID;const group='00000000-0000-4000-8000-000000000005';assert.equal((await post({...input,requestId:group,numbers:[5]})).code,201);
 await pg.query('delete from reservations where number=5');process.env.GMAIL_CLIENT_ID='test';await processEmails(group);assert.equal(sent.length,4);
});
test('HTML escapes user data, accepts official sender only, requires confirmed payment',async()=>{
 const result=await sendReservationEmail({email:input.email,name:'<script>bad</script>',player:'<b>Test</b>',numbers:[10]});assert.equal(result.status,'accepted');
 const html=Buffer.from(sent.at(-1).split('\r\n\r\n')[1],'base64').toString();assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.doesNotMatch(html,/Question de sécurité/);
 process.env.GMAIL_ACCOUNT_CONFIRMED='false';assert.equal((await sendReservationEmail(input)).status,'failed');process.env.GMAIL_ACCOUNT_CONFIRMED='true';
 process.env.PAYMENT_DETAILS_CONFIRMED='false';assert.equal((await post({...input,numbers:[6]})).code,503);process.env.PAYMENT_DETAILS_CONFIRMED='true';
});

test('persisting Gmail acceptance fails: reservation survives and sending is never reclaimed',async()=>{
 const group='00000000-0000-4000-8000-000000000006';failStatusWrite=true;
 const r=await post({...input,requestId:group,numbers:[6]});assert.equal(r.code,201);assert.equal(r.data.emailSent,false);
 const count=sent.length;failStatusWrite=false;await processEmails(group);assert.equal(sent.length,count);
 assert.equal((await pg.query('select * from reservations where number=6')).rows.length,1);
});
test('two workers cannot claim the same notification',async()=>{
 const group='00000000-0000-4000-8000-000000000007';
 await pg.query('select reserve_with_emails($1,$2,$3,$4,$5)',[group,[7],input.player,input.name,input.email]);
 const [a,b]=await Promise.all([pg.query('select * from claim_reservation_emails($1)',[group]),pg.query('select * from claim_reservation_emails($1)',[group])]);
 assert.equal(a.rows.length+b.rows.length,2);
});

test('email retry requires admin authentication',async()=>{
 const {default:admin}=await import('../api/admin.js');
 const res={setHeader(){},status(n){this.code=n;return this},json(data){this.data=data;return this}};
 await admin({method:'POST',query:{},headers:{},body:{action:'retry_email',groupId:id}},res);
 assert.equal(res.code,401);
});
