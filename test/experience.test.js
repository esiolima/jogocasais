const {test}=require('node:test');
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'../public',name),'utf8');
function bootHarness({seen=false,reduced=false,mascot=true}={}){
  const elements={},timers=[];
  for(const id of ['intro','boot-status','boot-progress','boot-retry','intro-skip','app'])elements[id]={hidden:false,inert:true,classList:{add(){}},focus(){}};
  const sandbox={document:{getElementById:id=>elements[id],querySelector:()=>({focus(){}})},sessionStorage:{getItem:()=>seen?'seen':null,setItem(){}},matchMedia:()=>({matches:reduced}),setTimeout:(fn,time)=>timers.push({fn,time}),location:{reload(){}}};
  if(mascot)sandbox.Mascot={};
  vm.runInNewContext(source('boot.js')+'\nthis.api=Boot;',sandbox);
  return {api:sandbox.api,elements,timers};
}
test('cover waits for real resources; skipping only skips animation',()=>{
  const b=bootHarness();b.elements['intro-skip'].onclick();b.api.mark('connection');
  assert.equal(b.elements.intro.hidden,false);b.api.mark('catalog');
  assert.equal(b.elements.intro.hidden,true);assert.equal(b.elements.app.inert,false);
});
test('reduced motion and return visits have zero cinematic delay',()=>{
  for(const opts of [{reduced:true},{seen:true}]){const b=bootHarness(opts);b.api.mark('connection');b.api.mark('catalog');b.timers.find(t=>t.time===0).fn();assert.equal(b.elements.intro.hidden,true);}
});
test('slow load and missing mascot expose an actionable retry',()=>{
  const b=bootHarness();b.timers.find(t=>t.time===4500).fn();assert.match(b.elements['boot-status'].textContent,/demorando/);
  const broken=bootHarness({mascot:false});assert.equal(broken.elements['boot-retry'].hidden,false);assert.equal(broken.elements.intro.hidden,false);
});
function audioHarness(){
  let contexts=0,suspended=0;const listeners={},players=[],gains=[],timers=new Set();
  const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(value){this.value=value;}});
  class AudioContext{constructor(){contexts++;this.currentTime=1;this.state='running';this.destination={};}createGain(){const node={gain:param(),connect(){},disconnect(){}};gains.push(node);return node;}createOscillator(){return{frequency:param(),connect(){},disconnect(){},start(){},stop(){}};}resume(){return Promise.resolve();}suspend(){suspended++;return Promise.resolve();}}
  const document={hidden:false,body:{append(){}},addEventListener:(n,f)=>listeners[n]=f,getElementById:()=>null,createElement:()=>{
    const p={dataset:{},paused:true,volume:0,removed:false,addEventListener(){},setAttribute(){},removeAttribute(){},load(){},remove(){this.removed=true;},pause(){this.paused=true;},play(){this.paused=false;return Promise.resolve();}};
    players.push(p);return p;
  }};
  const sandbox={window:{AudioContext},document,localStorage:{getItem:()=>null,setItem(){}},setInterval:fn=>{timers.add(fn);return fn;},clearInterval:fn=>timers.delete(fn)};
  vm.runInNewContext(source('sound.js')+'\nthis.api=Sound;',sandbox);
  return{api:sandbox.api,document,listeners,players,gains,timers,contexts:()=>contexts,suspended:()=>suspended};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('audio is lazy, preserves music position, mutes independently and pauses hidden tabs',async()=>{
  const h=audioHarness();assert.equal(h.players.length,0);assert.equal(h.contexts(),0);
  h.listeners.pointerdown({target:{closest:()=>true}});assert.equal(h.players.length,0);
  h.api.set('music',true);await flush();assert.equal(h.players.length,1);assert.equal(h.players[0].paused,false);assert.equal(h.contexts(),0);
  for(let i=0;i<20;i++)[...h.timers].forEach(fn=>fn());
  h.api.set('effects',true);assert.equal(h.contexts(),1);
  h.api.set('music',false);assert.equal(h.players[0].paused,true);assert(h.gains[0].gain.value>0);assert.equal(h.timers.size,0);
  h.api.set('music',true);await flush();assert.equal(h.players.length,1);assert.equal(h.players[0].paused,false);
  h.document.hidden=true;h.listeners.visibilitychange();assert(h.players.every(p=>p.paused));assert.equal(h.suspended(),1);
  h.document.hidden=false;h.listeners.visibilitychange();await flush();assert.equal(h.players[0].paused,false);
});
test('rapid track changes retire old audio, invalid tracks rejected and final mute silences all',async()=>{
  const h=audioHarness();h.api.set('music',true);await flush();
  h.api.set('track','passo-de-camaleao');h.api.set('track','fim-de-tarde');await flush();
  for(let i=0;i<21;i++)[...h.timers].forEach(fn=>fn());
  assert.equal(h.players.filter(p=>!p.removed).length,1);
  assert.match(h.players.at(-1).src,/fim-de-tarde/);
  h.api.set('track','https://invalid.example/audio.mp3');assert.equal(h.players.length,3);
  h.api.set('music',false);assert(h.players.every(p=>p.paused));
});
test('question palettes change between rounds, stay stable on answer and work in all modes',()=>{
  const body={dataset:{}},sandbox={document:{body,querySelector:()=>null},setTimeout(){}};
  vm.runInNewContext(source('mascot.js')+'\nthis.api=Mascot;',sandbox);
  const el={dataset:{},classList:{contains:()=>false,remove(){},add(){}},offsetWidth:100};
  const root={querySelector:()=>el};
  for(const mode of ['dupla','grupo','duelo']){
    const state={mode,screen:'game',roomCode:'ABC',game:{questionIndex:0},dueloLocalIndex:0,dueloQuestions:Array(10),dueloPhase:'setup'};
    sandbox.api.mount(root,state);const first=body.dataset.palette;
    sandbox.api.mount(root,{...state,game:{...state.game,myAnswer:'EU'}});assert.equal(body.dataset.palette,first);
    sandbox.api.mount(root,{...state,game:{questionIndex:1},dueloLocalIndex:1});assert.notEqual(body.dataset.palette,first);
  }
  sandbox.api.mount(root,{screen:'home'});assert.equal(body.dataset.palette,undefined);
});
