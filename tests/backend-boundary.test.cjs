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

test('discovery endpoint requires valid route format and propagates customer session',async()=>{
  const {state,load}=fixture();state.token='customer-session';
  const api=load('lib/backend/server.ts');
  state.result={
    rewards:[{id:'r-1',name:'Cafe gratis',points_required:100,remaining_quota:5,eligible:true}],
    campaigns:[{id:'c-1',name:'10% off',discount_percent:10,remaining_quota:10,eligible:true}],
    missions:[{id:'m-1',name:'Compra 2',goal:2,eligible:true}],
    stamps:{current_stamps:6,required_stamps:10,eligible:false}
  };
  const discovery=await api.backendRequest('/discovery/cafe-central/','GET');
  assert.equal(discovery.rewards[0].points_required,100);
  assert.equal(discovery.rewards[0].remaining_quota,5);
  assert.equal(discovery.campaigns[0].eligible,true);
  const call=state.calls.find(c=>c.url==='https://backend.example/api/discovery/cafe-central/');
  assert.ok(call);
  assert.equal(call.options.headers.Authorization,'Bearer customer-session');
});

test('award rules update uses the server-authorized tenant and validates non-negative integers',async()=>{
  const {state,load}=fixture();state.token='private-session';
  const id='40000000-0000-0000-0000-000000000004';
  state.result={business_id:id,active:true,businesses:[{id,slug:'my-biz',name:'My Biz',role:'owner'}]};
  const appUsers=load('lib/actions/app-users.ts');
  const formData=new Map([
    ['points_per_purchase','15'],['stamps_per_purchase','2'],['stamps_enabled','on'],['min_purchase_cents','0']
  ]);
  const fakeFormData={get:(k)=>formData.get(k)};
  await appUsers.updateBusinessAwardRules(fakeFormData);
  const putCall=state.calls.find(c=>c.url===`https://backend.example/api/businesses/${id}/award-rules/`&&c.options.method==='PUT');
  assert.ok(putCall);
  const body=JSON.parse(putCall.options.body);
  assert.equal(body.pointsPerPurchase,15);
  assert.equal(body.stampsPerPurchase,2);
  assert.equal(body.stampsEnabled,true);

  const invalidFormData={get:(k)=>k==='points_per_purchase'?'-5':formData.get(k)};
  await assert.rejects(appUsers.updateBusinessAwardRules(invalidFormData),/Los puntos por compra deben ser un número entero mayor o igual a 0/);
});

test('discovery catalog filters active businesses, supports search, category, pagination and isolates memberships', async () => {
  const {state, load} = fixture();
  state.token = 'customer-session';
  const customerApi = load('lib/data/customer.ts');

  state.result = {
    catalog: [
      {
        id: 'biz-1',
        slug: 'cafe-central',
        name: 'Cafe Central',
        category: 'Cafeteria',
        description: 'Especialidad',
        address: 'Cra 7',
        is_available: true,
        is_member: true,
        points_balance: 150,
        tier: 'Frecuente',
      }
    ],
    pagination: {
      page: 1,
      pageSize: 5,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
    rewards: [{ business_id: 'biz-1', name: 'Cafe gratis' }],
    campaigns: [{ business_id: 'biz-1', name: '10% desc' }]
  };

  const result = await customerApi.getExploreCatalog({ search: 'Cafe', category: 'Cafeteria', page: 1, pageSize: 5 });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, 'Cafe Central');
  assert.equal(result.items[0].isMember, true);
  assert.equal(result.items[0].points, 150);
  assert.equal(result.pagination.total, 1);

  const call = state.calls.find(c => c.url.includes('/api/discovery/'));
  assert.ok(call);
  assert.ok(call.url.includes('search=Cafe'));
  assert.ok(call.url.includes('category=Cafeteria'));
  assert.ok(call.url.includes('page=1'));
  assert.ok(call.url.includes('page_size=5'));
});

test('commerce profile distinguishes member and non-member, hides missions in MVP and allows joining', async () => {
  const {state, load} = fixture();
  state.token = 'customer-session';
  const customerApi = load('lib/data/customer.ts');
  const appUsers = load('lib/actions/app-users.ts');

  // 1. Non-member profile
  state.result = {
    business: {
      id: '50000000-0000-0000-0000-000000000005',
      slug: 'nuevo-cafe',
      name: 'Nuevo Cafe',
      category: 'Cafeteria',
      description: 'Café de especialidad',
      address: 'Calle 100',
      is_available: true,
      is_member: false,
      points_balance: 0,
      tier: 'Miembro',
      sedes: [{ id: '50000000-0000-0000-0000-000000000005', name: 'Sede Principal', address: 'Calle 100' }],
    },
    membership: null,
    stamps: null,
    rewards: [{ id: 'r-1', name: 'Bebida gratis', points_required: 50, eligible: false, condition: 'Requiere 50 puntos' }],
    campaigns: [{ id: 'c-1', name: '20% off', discount_percent: 20, eligible: false }],
    missions: [],
    activity: []
  };

  const nonMemberProfile = await customerApi.getCommerceProfile('nuevo-cafe');
  assert.equal(nonMemberProfile.business.isMember, false);
  assert.equal(nonMemberProfile.membership, null);
  assert.equal(nonMemberProfile.stamps, null);
  assert.equal(nonMemberProfile.rewards[0].eligible, false);
  assert.equal(nonMemberProfile.missions.length, 0); // Hidden in MVP
  assert.equal(nonMemberProfile.business.sedes.length, 1);

  // 2. Joining the commerce via joinBusinessAction
  state.result = { id: 'mem-new' };
  const joinResult = await appUsers.joinBusinessAction('50000000-0000-0000-0000-000000000005');
  assert.equal(joinResult.ok, true);
  const joinCall = state.calls.find(c => c.url === 'https://backend.example/api/memberships/50000000-0000-0000-0000-000000000005/' && c.options.method === 'POST');
  assert.ok(joinCall);

  // 3. Member profile with V1 phase
  state.result = {
    business: {
      id: '50000000-0000-0000-0000-000000000005',
      slug: 'nuevo-cafe',
      name: 'Nuevo Cafe',
      category: 'Cafeteria',
      is_available: true,
      is_member: true,
      points_balance: 80,
      tier: 'Frecuente',
      sedes: [{ id: '50000000-0000-0000-0000-000000000005', name: 'Sede Principal', address: 'Calle 100' }],
    },
    membership: { id: 'mem-new', points_balance: 80, tier: 'Frecuente' },
    stamps: { current_stamps: 4, required_stamps: 10, reward_name: 'Café gratis', eligible: false },
    rewards: [{ id: 'r-1', name: 'Bebida gratis', points_required: 50, eligible: true, condition: 'Disponible' }],
    campaigns: [{ id: 'c-1', name: '20% off', discount_percent: 20, eligible: true }],
    missions: [{ id: 'm-1', name: 'Misión V1', goal: 3, reward_points: 30, eligible: true }],
    activity: [{ id: 'ev-1', event_type: 'purchase', points_delta: 20 }]
  };

  const memberProfile = await customerApi.getCommerceProfile('nuevo-cafe', 'v1');
  assert.equal(memberProfile.business.isMember, true);
  assert.equal(memberProfile.membership?.tier, 'Frecuente');
  assert.equal(memberProfile.business.points, 80);
  assert.equal(memberProfile.rewards[0].eligible, true);
  assert.equal(memberProfile.stamps?.currentStamps, 4);
  assert.equal(memberProfile.missions.length, 1);
});




