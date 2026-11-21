// HTTP/provider mocks verify the web boundary; real Auth is tested separately in Docker staging.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');

function fixture(){
  const state={token:null,calls:[],writes:[],confirmed:true,providerCalls:0};
  const cache=new Map();
  class NextResponse extends Response {
    constructor(body,options){super(body,options);this.cookies={
      set:(name,value,options)=>state.writes.push({name,value,options}),
      delete:name=>state.writes.push({name,deleted:true}),
    };}
    static json(value,options){return new NextResponse(JSON.stringify(value),options);}
  }
  function load(relative){
    const file=path.resolve(__dirname,'..',relative);
    if(cache.has(file))return cache.get(file).exports;
    const module={exports:{}};cache.set(file,module);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{
      compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
    }).outputText,{
      module,exports:module.exports,URL,Request,Response,AbortSignal,Error,
      process:{env:{NEXT_PUBLIC_DJANGO_BUSINESS_API_ENABLED:'true',LOYLOOP_DJANGO_API_URL:'https://backend.example',NODE_ENV:'production'}},
      fetch:async(url,options)=>{state.calls.push({url,options});return new Response(JSON.stringify(state.result??{ok:true}),{status:state.status??200});},
      require:name=>{
        if(name==='server-only')return {};
        if(name==='next/cache')return {revalidatePath:()=>{},revalidateTag:()=>{}};
        if(name==='next/headers')return {cookies:async()=>({get:()=>state.token?{value:state.token}:undefined})};
        if(name==='next/server')return {NextResponse};
        if(name==='@/lib/supabase/client')return {supabase:{auth:{getUser:async()=>{state.providerCalls++;return {data:{user:{email_confirmed_at:state.confirmed?'confirmed':null,is_anonymous:false}},error:null};}}}};
        const target=name.startsWith('@/')?name.slice(2):path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(file),name));
        return load(target+'.ts');
      },
    },{filename:file});
    return module.exports;
  }
  return {state,load};
}

test('server writes require a session; errors never fall back or expose diagnostics',async()=>{
  const {state,load}=fixture();const api=load('lib/backend/server.ts');
  await assert.rejects(api.backendRequest('/customer-identity/','POST',{}),e=>e.status===401);
  assert.equal(state.calls.length,0);
  state.token='private-session';state.status=500;state.result={detail:'database password private-session'};
  await assert.rejects(api.backendRequest('/customer-identity/','POST',{}),e=>e.status===500&&!e.message.includes('password')&&!e.message.includes('private-session'));
  assert.equal(state.calls.length,1);
  assert.equal(state.calls[0].options.headers.Authorization,'Bearer private-session');
});

test('session bridge rejects cross-origin requests before provider access',async()=>{
  const {state,load}=fixture();const route=load('app/api/backend-session/route.ts');
  const response=await route.POST(new Request('https://admin.example/api/backend-session',{method:'POST',headers:{Origin:'https://unrelated.example'},body:JSON.stringify({accessToken:'a.b.c'})}));
  assert.equal(response.status,403);assert.equal(state.providerCalls,0);assert.equal(state.writes.length,0);
});

test('only a provider-confirmed session becomes a secure HttpOnly cookie',async()=>{
  const {state,load}=fixture();const route=load('app/api/backend-session/route.ts');
  const request=()=>new Request('https://admin.example/api/backend-session',{method:'POST',headers:{Origin:'https://admin.example'},body:JSON.stringify({accessToken:'a.b.c'})});
  state.confirmed=false;assert.equal((await route.POST(request())).status,401);assert.equal(state.writes.length,0);
  state.confirmed=true;const response=await route.POST(request());
  assert.equal(response.status,200);assert.equal((await response.text()).includes('a.b.c'),false);
  assert.equal(state.writes[0].options.httpOnly,true);assert.equal(state.writes[0].options.secure,true);assert.equal(state.writes[0].options.sameSite,'strict');
});

test('cookie-backed proxy denies cross-origin writes and malformed routes',async()=>{
  const {state,load}=fixture();state.token='private-session';const route=load('app/api/backend/[...path]/route.ts');
  const request=new Request('https://admin.example/api/backend/customer-identity/',{method:'POST',headers:{Origin:'https://unrelated.example'},body:'{}'});
  assert.equal((await route.POST(request,{params:Promise.resolve({path:['customer-identity']})})).status,403);
  assert.equal((await route.GET(new Request('https://admin.example/api/backend/bad'),{params:Promise.resolve({path:['..']})})).status,400);
  assert.equal(state.calls.length,0);
});

test('offer actions use the server-authorized tenant and reject a submitted foreign tenant',async()=>{
  const {state,load}=fixture();state.token='private-session';
  const id='10000000-0000-0000-0000-000000000001';
  state.result={business_id:id,active:true,businesses:[{id,slug:'own',name:'Own',role:'owner'}]};
  const api=load('lib/backend/offers.ts');
  await assert.rejects(api.writeOffer('rewards','POST',{business_id:'another',name:'Rejected'}));
  assert.equal(state.calls.filter(c=>c.options.method==='POST').length,0);
  await api.writeOffer('rewards','POST',{business_id:id,name:'Own reward',type:'product'});
  const write=state.calls.find(c=>c.options.method==='POST');
  assert.equal(write.url,`https://backend.example/api/businesses/${id}/rewards/`);
  assert.equal(JSON.parse(write.options.body).business_id,undefined);
});

test('dashboard root does not grant cashier or manager access to owner settings',()=>{
  const {load}=fixture();const {canAccessDashboard:can}=load('lib/auth-access.ts');
  assert.equal(can('/dashboard','cashier'),true);
  assert.equal(can('/dashboard/validar','cashier'),true);
  assert.equal(can('/dashboard/configuracion','cashier'),false);
  assert.equal(can('/dashboard/solicitudes','cashier'),false);
  assert.equal(can('/dashboard/recompensas','manager'),true);
  assert.equal(can('/dashboard/configuracion','manager'),false);
  assert.equal(can('/dashboard/configuracion','owner'),true);
});

test('claim preview and validation use the server-authorized tenant and reject cross-origin requests',async()=>{
  const {state,load}=fixture();state.token='private-session';
  const id='20000000-0000-0000-0000-000000000002';
  state.result={business_id:id,active:true,businesses:[{id,slug:'test-cafe',name:'Test Cafe',role:'cashier'}]};
  const claims=load('lib/claims.ts');
  await claims.previewClaimRequest('CLAIM-CODE-123');
  const previewCall=state.calls.find(c=>c.url===`https://backend.example/api/businesses/${id}/claims/preview/`);
  assert.ok(previewCall);
  assert.equal(JSON.parse(previewCall.options.body).code,'CLAIM-CODE-123');

  const previewRoute=load('app/api/claim-requests/preview/route.ts');
  const crossOrigin=new Request('https://admin.example/api/claim-requests/preview',{
    method:'POST',headers:{Origin:'https://malicious.example'},body:JSON.stringify({code:'CLAIM-123'})
  });
  assert.equal((await previewRoute.POST(crossOrigin)).status,403);
});

test('business profile update uses the server-authorized tenant and requires valid fields',async()=>{
  const {state,load}=fixture();state.token='private-session';
  const id='30000000-0000-0000-0000-000000000003';
  state.result={business_id:id,active:true,businesses:[{id,slug:'my-cafe',name:'My Cafe',role:'owner'}]};
  const appUsers=load('lib/actions/app-users.ts');
  const formData=new Map([
    ['name','Nuevo Nombre'],['category','Cafeteria'],['address','Cra 7 #45-12'],['city','Bogota'],['description','Desc']
  ]);
  const fakeFormData={get:(k)=>formData.get(k)};
  await appUsers.updateBusinessProfile(fakeFormData);
  const patchCall=state.calls.find(c=>c.url===`https://backend.example/api/businesses/${id}/`&&c.options.method==='PATCH');
  assert.ok(patchCall);
  const body=JSON.parse(patchCall.options.body);
  assert.equal(body.name,'Nuevo Nombre');
  assert.equal(body.category,'Cafeteria');
  assert.equal(body.address,'Cra 7 #45-12');

  const emptyFormData={get:(k)=>k==='name'?'':formData.get(k)};
  await assert.rejects(appUsers.updateBusinessProfile(emptyFormData),/El nombre del comercio es obligatorio/);
});
