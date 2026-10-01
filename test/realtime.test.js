const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');
let server; const clients=[];
before(async()=>{
  server=spawn(process.execPath,['server.js'],{cwd:require('node:path').join(__dirname,'..'),env:{...process.env,PORT:'3107'},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('server timeout')),5000);server.stdout.once('data',()=>{clearTimeout(t);resolve();});server.once('error',reject);});
});
after(()=>{clients.forEach(c=>c.ws.close());server.kill();});
async function player(){
  const ws=new WebSocket('ws://127.0.0.1:3107'); const messages=[];
  ws.on('message',raw=>messages.push(JSON.parse(raw)));
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  const client={ws,messages,send:obj=>ws.send(JSON.stringify(obj)),async get(type,predicate=()=>true){
    const start=Date.now();while(Date.now()-start<4000){const i=messages.findIndex(m=>m.type===type&&predicate(m));if(i>=0)return messages.splice(i,1)[0];await new Promise(r=>setTimeout(r,5));}throw Error('Timeout: '+type);
  }};clients.push(client);return client;
}
test('Dupla: lookup, second pair, privacy, chat, scoring, skip and final result',async()=>{
  const a=await player(),b=await player(),c=await player();
  a.send({type:'create_room',mode:'dupla',name:'Ana',customQuestions:['Quem faria um bolo?','Quem escolheria a música?']});
  const room=await a.get('room_created');
  b.send({type:'lookup_room',code:room.code});assert.equal((await b.get('lookup_result')).found,true);
  c.send({type:'join_room',code:room.code,name:'Cris',target:'new'});await c.get('joined');c.send({type:'leave'});
  b.send({type:'join_room',code:room.code,name:'Bia',target:room.coupleId});await b.get('joined');
  a.send({type:'chat_send',text:'Oi, dupla!'});assert.equal((await b.get('chat_message')).text,'Oi, dupla!');
  a.send({type:'start_game'});await a.get('game_state');await b.get('game_state');
  a.send({type:'answer',choice:'EU'});assert.equal((await b.get('game_state')).partnerAnswer,null);
  b.send({type:'answer',choice:'VOCE'});const result=await a.get('game_state',m=>m.revealed);assert.equal(result.score,1);assert.equal(result.match,true);
  a.send({type:'ready'});b.send({type:'ready'});await a.get('game_state',m=>m.questionIndex===1);
  a.send({type:'answer',choice:'PULAR'});b.send({type:'answer',choice:'EU'});assert.equal((await a.get('game_state',m=>m.questionIndex===1&&m.revealed)).skipped,true);
  a.send({type:'ready'});b.send({type:'ready'});assert.equal((await a.get('game_finished')).results[0].score,1);
});
test('Grupo: minimum players, majority vote, tie, skip and report',async()=>{
  const ps=await Promise.all([player(),player(),player()]);const [a,b,c]=ps;
  a.send({type:'create_room',mode:'grupo',name:'Ana',customQuestions:['Quem cozinha?','Quem canta?','Quem dança?']});const room=await a.get('room_created');
  a.send({type:'start_game'});assert.match((await a.get('error')).message,/3 pessoas/);
  for(const [i,p] of [b,c].entries()){p.send({type:'join_room',code:room.code,name:['Bia','Cris'][i]});p.id=(await p.get('joined')).playerId;}a.id=room.playerId;
  a.send({type:'start_game'});await a.get('game_state');
  ps.forEach(p=>p.send({type:'vote',targetId:a.id}));assert.equal((await a.get('game_state',m=>m.allVoted)).winnerId,a.id);
  ps.forEach(p=>p.send({type:'ready'}));await a.get('game_state',m=>m.questionIndex===1);
  ps.forEach(p=>p.send({type:'vote',targetId:p.id}));assert.equal((await a.get('game_state',m=>m.questionIndex===1&&m.allVoted)).tie,true);
  ps.forEach(p=>p.send({type:'ready'}));await a.get('game_state',m=>m.questionIndex===2);
  ps.forEach(p=>p.send({type:'vote',targetId:'PULAR'}));assert.equal((await a.get('game_state',m=>m.questionIndex===2&&m.allVoted)).skipped,true);
  ps.forEach(p=>p.send({type:'ready'}));assert.equal((await a.get('game_finished')).report.find(p=>p.name==='Ana').count,1);
});
test('Duelo: generated quiz, private setup, invalid options rejected, correct/wrong guesses and winner',async()=>{
  const a=await player(),b=await player();a.send({type:'create_room',mode:'duelo',name:'Ana',questionCount:10});const room=await a.get('room_created');
  b.send({type:'join_room',code:room.code,name:'Bia'});await b.get('joined');a.send({type:'start_game'});
  const setup=await a.get('duelo_setup');await b.get('duelo_setup');assert.equal(setup.questions.length,10);assert(setup.questions.some(q=>q.source==='rules'));
  a.send({type:'setup_answer',index:0,choice:99});
  for(let i=0;i<10;i++){a.send({type:'setup_answer',index:i,choice:0});b.send({type:'setup_answer',index:i,choice:1});}
  const guess=await a.get('duelo_guess_start');await b.get('duelo_guess_start');assert(!JSON.stringify(guess).includes('setupAnswers'));
  for(let i=0;i<10;i++){a.send({type:'guess_answer',index:i,choice:1});b.send({type:'guess_answer',index:i,choice:2});assert.equal((await a.get('duelo_guess_result')).correct,true);assert.equal((await b.get('duelo_guess_result')).correct,false);}
  const result=await a.get('game_finished');assert.equal(result.winnerName,'Ana');assert.deepEqual(result.scores.map(s=>s.score),[10,0]);
});
test('Ranking with tension retains per-theme point values in all 20 rounds',async()=>{
  const themes=require('../themes.json'); const a=await player(),b=await player();
  a.send({type:'create_room',mode:'dupla',name:'Ana',themeId:'aleatorio',rankingMode:true,tensionMode:true,questionCount:20});
  const room=await a.get('room_created');b.send({type:'join_room',code:room.code,name:'Bia',target:room.coupleId});await b.get('joined');a.send({type:'start_game'});
  let total=0;
  for(let i=0;i<20;i++) {
    const q=await a.get('game_state',m=>m.questionIndex===i&&!m.revealed&&m.myAnswer===null);
    const expected=themes.find(t=>t.name===q.themeName).rankingPoints;assert.equal(q.questionValue,expected);total+=expected;
    a.send({type:'answer',choice:'EU'});b.send({type:'answer',choice:'VOCE'});
    assert.equal((await a.get('game_state',m=>m.questionIndex===i&&m.revealed)).score,total);
    a.send({type:'ready'});b.send({type:'ready'});
  }
  assert.equal((await a.get('game_finished')).results[0].score,total);
});
