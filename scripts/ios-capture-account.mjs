import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
const file='work/ios-capture-account.json', base='https://daily-compass-api.onrender.com';
if(process.argv.includes('--cleanup')){
 try{const c=JSON.parse(await readFile(file,'utf8'));const r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c)});if(r.ok){const s=await r.json();const d=await fetch(base+'/api/account',{method:'DELETE',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify({password:c.password})});if(!d.ok)throw Error('Cleanup failed');}console.log('Temporary empty screenshot account cleaned up.');}catch{console.log('Screenshot account cleanup needs checking; no personal data was used.');}process.exit(0);
}
const c={email:'store-capture-'+randomBytes(8).toString('hex')+'@dailycompass.example',password:randomBytes(24).toString('base64url')+'!a9',name:'Alex',age:30};
const r=await fetch(base+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c)});
if(!r.ok)throw Error('Cannot prepare screenshot account: '+r.status);
console.log('::add-mask::'+c.password);console.log('::add-mask::'+c.email);
await mkdir('work',{recursive:true});await writeFile(file,JSON.stringify(c),{mode:0o600});
await writeFile(process.env.GITHUB_ENV,`CAPTURE_EMAIL=${c.email}\nCAPTURE_PASSWORD=${c.password}\n`,{flag:'a'});
console.log('Prepared an empty temporary account for genuine native screenshots.');
