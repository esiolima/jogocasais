const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const source = name => fs.readFileSync(path.join(__dirname,'../public',name),'utf8');
function bootHarness({seen=false,reduced=false}={}) {
  const elements = {}, timers = [];
  for(const id of ['intro','boot-status','boot-progress','boot-retry','intro-skip','app']) elements[id]={hidden:false,inert:true,classList:{add(){}},focus(){}};
  let image;
  const sandbox={document:{getElementById:id=>elements[id],querySelector:()=>({focus(){}})},sessionStorage:{getItem:()=>seen?'seen':null,setItem(){}},matchMedia:()=>({matches:reduced}),setTimeout:(fn,time)=>timers.push({fn,time}),location:{reload(){}},Image:class{constructor(){image=this;}}};
  vm.runInNewContext(source('boot.js')+'\nthis.api=Boot;',sandbox);
  return {api:sandbox.api,elements,timers,image};
}
test('cover waits for real resources; skipping only skips animation',()=>{
  const b=bootHarness();b.elements['intro-skip'].onclick();b.api.mark('connection');b.api.mark('catalog');
  assert.equal(b.elements.intro.hidden,false);b.image.onload();assert.equal(b.elements.intro.hidden,true);assert.equal(b.elements.app.inert,false);
});
test('reduced motion and return visits have zero cinematic delay',()=>{
  for(const opts of [{reduced:true},{seen:true}]) {const b=bootHarness(opts);b.api.mark('connection');b.api.mark('catalog');b.image.onload();b.timers.find(t=>t.time===0).fn();assert.equal(b.elements.intro.hidden,true);}
});
test('slow load and failed image expose an actionable retry',()=>{
  const b=bootHarness();b.timers.find(t=>t.time===4500).fn();assert.match(b.elements['boot-status'].textContent,/demorando/);b.image.onerror();assert.equal(b.elements['boot-retry'].hidden,false);assert.equal(b.elements.intro.hidden,false);
});
test('audio has no autoplay, reuses one context, mutes independently and pauses in hidden tabs',()=>{
  let contexts=0, voices=0, suspended=0;const listeners={},gains=[],timers=new Set();
  const gain=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(value){this.value=value;}});
  class AudioContext {constructor(){contexts++;this.currentTime=1;this.state='running';this.destination={};}createGain(){const node={gain:gain(),connect(){},disconnect(){}};gains.push(node);return node;}createOscillator(){voices++;return{frequency:{},connect(){},disconnect(){},start(){},stop(){}};}resume(){return Promise.resolve();}suspend(){suspended++;return Promise.resolve();}}
  const document={hidden:false,addEventListener:(name,fn)=>listeners[name]=fn,getElementById:()=>null};
  const sandbox={window:{AudioContext},document,localStorage:{getItem:()=>null,setItem(){}},setInterval:fn=>{timers.add(fn);return fn;},clearInterval:fn=>timers.delete(fn)};
  vm.runInNewContext(source('sound.js')+'\nthis.api=Sound;',sandbox);
  assert.equal(contexts,0);listeners.pointerdown({target:{closest:()=>true}});assert.equal(contexts,0);
  sandbox.api.set('music',true);assert.equal(contexts,1);assert(voices>0);assert.equal(timers.size,1);
  sandbox.api.set('effects',true);sandbox.api.cue('success');assert.equal(contexts,1);
  sandbox.api.set('music',false);assert.equal(gains[1].gain.value,0);assert(gains[2].gain.value>0);assert.equal(timers.size,0);
  document.hidden=true;listeners.visibilitychange();assert.equal(suspended,1);
});
