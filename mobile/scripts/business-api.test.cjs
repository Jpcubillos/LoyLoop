const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const moduleObject = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/business-api-client.ts'),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText, {module:moduleObject,exports:moduleObject.exports,URL,AbortController,setTimeout,clearTimeout,Error,TypeError,fetch});
const { createBusinessApi } = moduleObject.exports;

test('Django writes carry the current bearer, never an email identity; each write is sent once', async () => {
  const calls=[];
  const api=createBusinessApi('https://backend.example',async()=> 'verified-session',async(url,options)=>{
    calls.push({url,options});return {ok:true,status:201,json:async()=>({customer_id:'own-profile'})};
  });
  assert.equal((await api('/customer-identity/','POST',{})).customer_id,'own-profile');
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://backend.example/api/customer-identity/');
  assert.equal(calls[0].options.headers.Authorization,'Bearer verified-session');
  assert.equal(calls[0].options.body,'{}');
});

test('Missing sessions and invalid origins fail before any network write', async () => {
  let count=0;const transport=async()=>{count++;throw new Error('Unexpected network');};
  for (const url of ['http://public.example','https://user:pass@backend.example','https://backend.example/path']) {
    await assert.rejects(createBusinessApi(url,async()=> 'session',transport)('/memberships/one/','POST',{}));
  }
  await assert.rejects(createBusinessApi('https://backend.example',async()=>null,transport)('/customer-identity/','POST',{}));
  assert.equal(count,0);
});

test('Expired sessions and server errors never leak diagnostics or fall back to direct writes', async () => {
  for (const status of [400,401,403,409,500,503]) {
    let count=0;
    const api=createBusinessApi('https://backend.example',async()=> 'secret',async()=>{
      count++;return {ok:false,status,json:async()=>({detail:'PASSWORD secret database row'})};
    });
    await assert.rejects(api('/claim-requests/','POST',{}),error=> !error.message.includes('secret') && !error.message.includes('PASSWORD'));
    assert.equal(count,1);
  }
});

test('Successful deletion accepts an empty 204 body', async () => {
  const api=createBusinessApi('https://backend.example',async()=> 'session',async()=>({ok:true,status:204,json:async()=>{throw new Error('Must not parse');}}));
  assert.equal(await api('/account/','DELETE'),undefined);
});

test("Anonymous discovery cannot become an anonymous write or private API read", async () => {
  let calls=0;
  const request=createBusinessApi("https://api.example.test",async()=>null,async(url,options)=>{
    calls++;assert.equal(options.headers.Authorization,undefined);
    return {ok:true,status:200,json:async()=>({catalog:[]})};
  },true);
  await request("/discovery/");assert.equal(calls,1);
  await assert.rejects(request("/discovery/","POST",{}));
  await assert.rejects(request("/customer-identity/"));
  assert.equal(calls,1);
});
