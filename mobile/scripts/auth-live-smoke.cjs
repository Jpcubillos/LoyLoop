// Explicit real login/logout only. Never sends signup/recovery mail or changes passwords.
const {chromium}=require('@playwright/test');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
async function main(){
 if(!process.argv.includes('--configured-demo'))throw new Error('Explicit test account authorization required');
 const source=fs.readFileSync(path.resolve(__dirname,'../../components/auth-form.tsx'),'utf8');
 const email=[...source.matchAll(/setEmail\("([^"\n]+)"\)/g)].map(m=>m[1]).find(v=>v.endsWith('@loyloop.app'));
 const password=[...source.matchAll(/setPassword\("([^"\n]+)"\)/g)][0]?.[1];
 if(!email||!password)throw new Error('Configured test account unavailable');
 const url='http://localhost:8092';
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('**/api/**',route=>{
   if(new URL(route.request().url()).origin!=='http://127.0.0.1:8001')return route.abort();
   return route.continue();
  });
  await page.goto(url+'/login',{waitUntil:'networkidle',timeout:120000});
  await page.getByLabel('Correo electrónico',{exact:true}).fill(email);
  await page.getByLabel('Contraseña',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await page.waitForURL(u=>u.pathname==='/',{timeout:45000});
  await page.goto(url+'/perfil',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:/Cerrar sesión/}).waitFor();
  await page.reload({waitUntil:'networkidle'});
  await page.getByRole('button',{name:/Cerrar sesión/}).waitFor();
  await page.getByRole('button',{name:/Cerrar sesión/}).click();
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).last().click();
  await page.waitForURL(u=>u.pathname==='/login');
  await page.goto(url+'/perfil',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:/Iniciar sesión/}).waitFor();
  assert.equal(await page.getByText(email,{exact:true}).count(),0);
  const sessions=await page.evaluate(()=>Object.keys(localStorage).filter(k=>/auth-token$|recovery/.test(k)));
  assert.deepEqual(sessions,[]);
  fs.writeFileSync(path.resolve(__dirname,'../../backend/.docker/ll11-real-login-evidence.json'),JSON.stringify({timestamp_utc:new Date().toISOString(),scope:'Real Supabase Auth and loopback Django, configured demo account in client web UI',login:'passed',session_reload:'passed',logout:'passed',no_stale_account:'passed',native_securestore:'not_tested',signup_email_otp:'not_tested',recovery_email_otp:'not_tested'},null,2));
  console.log('Real client login, reload persistence, logout and session cleanup passed; no credentials or personal data captured.');
 }finally{await browser.close();}
}
main().catch(error=>{console.error('Real auth UI verification failed ('+error.name+'). No screenshot or credential output recorded.');process.exitCode=1;});
