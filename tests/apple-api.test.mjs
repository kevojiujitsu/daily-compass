import http from 'node:http';import {spawn} from 'node:child_process';import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
const portServer=http.createServer();await new Promise(r=>portServer.listen(0,'127.0.0.1',r));const port=portServer.address().port;await new Promise(r=>portServer.close(r));
await mkdir('work/ios-api-fixture',{recursive:true});const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:String(port),DAILY_COMPASS_DATA_DIR:process.cwd()+'/work/ios-api-fixture',APPLE_BILLING_ENABLED:'true'},stdio:'ignore'});const base='http://127.0.0.1:'+port;
try{for(let i=0;i<60;i++){try{if((await fetch(base+'/api/status')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const registration=await fetch(base+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'API Test',age:30,email:'api-'+Date.now()+'@example.test',password:'Test-fixture-only-58239!a'})});const user=await registration.json();assert.equal(registration.status,201);const headers={'Content-Type':'application/json',Authorization:'Bearer '+user.token};
const q=await(await fetch(base+'/api/quota',{headers})).json();assert.equal(q.quota.appleBillingReady,true);assert.equal(q.appleAccountToken,user.user.id);assert.equal(q.quota.tier,'free');
assert.equal((await fetch(base+'/api/billing/apple/verify',{method:'POST',headers,body:JSON.stringify({signedTransaction:'forged'})})).status,400);
assert.equal((await fetch(base+'/api/billing/apple/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
assert.equal((await fetch(base+'/api/billing/apple/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({signedPayload:'forged'})})).status,400);
assert.equal((await(await fetch(base+'/api/quota',{headers})).json()).quota.tier,'free');console.log('PASS: authenticated Apple quota/account token, unauthorized and forged purchase rejection, unauthenticated signed-notification boundary, no entitlement granted.');
}finally{child.kill();}

