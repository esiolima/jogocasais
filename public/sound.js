/* Original, locally hosted instrumental scores. Streamed on demand.
 * Web Audio is used only for responsive effects; no runtime service. */
const Sound = (() => {
  const tracks = [
    {id:'jardim-de-conexoes',name:'Jardim de conexões',detail:'Bossa leve · cordas, piano e percussão'},
    {id:'passo-de-camaleao',name:'Passo de camaleão',detail:'Mais brincalhona · marimba e balanço'},
    {id:'fim-de-tarde',name:'Fim de tarde',detail:'Mais tranquila · piano e acordes suaves'}
  ];
  let prefs={music:false,effects:false,volume:.45,track:tracks[0].id};
  let context,master,unlocked=false,current,retiring,fadeTimer,generation=0,message='';
  const players=new Set();
  try {
    const saved=JSON.parse(localStorage.getItem('conectai-sound'));
    if(saved)prefs={music:saved.music===true,effects:saved.effects===true,
      volume:Number.isFinite(saved.volume)?Math.max(0,Math.min(1,saved.volume)):.45,
      track:tracks.some(t=>t.id===saved.track)?saved.track:tracks[0].id};
  } catch { /* optional persistence */ }
  function status(text){message=text;const el=document.getElementById('audio-status');if(el)el.textContent=text;}
  function discard(audio){if(!audio)return;audio.pause();audio.removeAttribute('src');audio.load();audio.remove();players.delete(audio);}
  function stopFade(){clearInterval(fadeTimer);fadeTimer=null;discard(retiring);retiring=null;}
  const volume=()=>prefs.volume*.65;
  function fadeIn(audio,old){
    stopFade();retiring=old;
    let progress=0;const oldVolume=old?.volume||0;
    fadeTimer=setInterval(()=>{
      progress=Math.min(1,progress+.05);
      audio.volume=volume()*Math.sin(progress*Math.PI/2);
      if(old)old.volume=oldVolume*Math.cos(progress*Math.PI/2);
      if(progress>=1)stopFade();
    },35);
  }
  async function playMusic(){
    if(!unlocked||!prefs.music||document.hidden)return;
    if(current?.dataset.track===prefs.track){
      if(current.paused&&!current.error){
        try{await current.play();}catch{status('Toque em Música de fundo para tentar novamente.');}
      }
      return;
    }
    const token=++generation,previous=current;
    const audio=document.createElement('audio');
    players.add(audio);
    audio.dataset.track=prefs.track;audio.loop=true;audio.preload='none';audio.volume=0;
    audio.setAttribute('aria-hidden','true');audio.hidden=true;
    audio.src='/assets/music/'+prefs.track+'.mp3';current=audio;
    audio.addEventListener('waiting',()=>{if(current===audio)status('Carregando a trilha…');});
    audio.addEventListener('playing',()=>{if(current===audio)status('Tocando: '+tracks.find(t=>t.id===audio.dataset.track).name);});
    audio.addEventListener('error',()=>{if(current===audio)status('A trilha não carregou. Desligue e ligue a música para tentar novamente.');});
    document.body.append(audio);status('Carregando a trilha…');
    try{
      await audio.play();
      if(token!==generation||document.hidden||!prefs.music){discard(previous);return;}
      fadeIn(audio,previous);
    }catch{
      discard(previous);
      if(token===generation)status('Não foi possível tocar. Desligue e ligue a música para tentar novamente.');
    }
  }
  function ensureEffects(){
    if(!context){
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;
      context=new Audio();master=context.createGain();master.connect(context.destination);
    }
    if(context.state==='suspended')context.resume().catch(()=>{});
    master.gain.setTargetAtTime(prefs.effects?prefs.volume*.24:0,context.currentTime,.025);
    return true;
  }
  function update(){
    if(!unlocked)return;
    if(context)master.gain.setTargetAtTime(prefs.effects?prefs.volume*.24:0,context.currentTime,.025);
    if(document.hidden||!prefs.music){
      generation++;stopFade();players.forEach(audio=>audio.pause());status(document.hidden?'Música pausada nesta aba.':'Música desligada.');
    }else{
      if(current&&!fadeTimer)current.volume=volume();
      playMusic();
    }
  }
  const frequency=n=>440*2**((n-69)/12);
  function voice(note,at,duration,level,type='sine'){
    const osc=context.createOscillator(),env=context.createGain();
    osc.type=type;osc.frequency.setValueAtTime(frequency(note),at);
    env.gain.setValueAtTime(0,at);env.gain.linearRampToValueAtTime(level,at+.009);
    env.gain.exponentialRampToValueAtTime(.0001,at+duration);
    osc.connect(env);env.connect(master);osc.start(at);osc.stop(at+duration+.03);
    osc.onended=()=>{osc.disconnect();env.disconnect();};
  }
  let lastCue=-1;
  function cue(name){
    if(!unlocked||!prefs.effects||document.hidden||!ensureEffects())return;
    if(name==='tap'&&context.currentTime-lastCue<.055)return;
    lastCue=context.currentTime;
    const notes={tap:[79],answer:[72,79],success:[72,76,79,84],error:[74,72],result:[72,76,79,83,84],join:[67,72,76],warning:[72,69],mascot:[79,84,81]}[name]||[79];
    notes.forEach((n,i)=>{
      const at=context.currentTime+.01+i*.095;
      voice(n,at,name==='tap'?.09:.42,name==='tap'?.17:.30);
      if(name==='success'||name==='result')voice(n+12,at,.25,.045,'triangle');
    });
  }
  function set(key,value){
    if(key==='track'){if(!tracks.some(t=>t.id===value))return;prefs.track=value;}
    else if(key==='volume'){const n=Number(value);if(!Number.isFinite(n))return;prefs.volume=Math.max(0,Math.min(1,n));}
    else if(key==='music'||key==='effects')prefs[key]=Boolean(value);else return;
    if(key==='music'&&value&&current?.error){discard(current);current=null;}
    unlocked=true;update();
    try{localStorage.setItem('conectai-sound',JSON.stringify(prefs));}catch{/* optional */}
    const button=document.getElementById('sound-button');if(button)button.textContent=label();
    if(key==='effects'&&value)cue('success');
  }
  function label(){return prefs.music||prefs.effects?'Som ligado':'Som desligado';}
  function open(){
    if(document.getElementById('sound-dialog'))return;
    const dialog=document.createElement('dialog');dialog.id='sound-dialog';dialog.setAttribute('aria-labelledby','sound-title');
    dialog.innerHTML='<h2 id="sound-title">Qual é o clima?</h2><p>Três trilhas instrumentais feitas para acompanhar a brincadeira.</p>'
      +'<label class="sound-option"><span>Música de fundo</span><input type="checkbox" '+(prefs.music?'checked':'')+' onchange="Sound.set(\'music\',this.checked)"></label>'
      +'<fieldset class="sound-tracks"><legend>Escolha sua trilha</legend>'+tracks.map(t=>'<label class="sound-track"><input type="radio" name="music-track" value="'+t.id+'" '+(prefs.track===t.id?'checked':'')+' onchange="Sound.set(\'track\',this.value)"><span><strong>'+t.name+'</strong><small>'+t.detail+'</small></span></label>').join('')+'</fieldset>'
      +'<p class="audio-status" id="audio-status" role="status"></p>'
      +'<label class="sound-option"><span>Efeitos do jogo</span><input type="checkbox" '+(prefs.effects?'checked':'')+' onchange="Sound.set(\'effects\',this.checked)"></label>'
      +'<label class="sound-volume" for="sound-volume">Volume</label><input id="sound-volume" type="range" min="0" max="1" step=".05" value="'+prefs.volume+'" oninput="Sound.set(\'volume\',this.value)">'
      +'<p class="hint">A música pausa quando você sai desta aba.</p><form method="dialog"><button class="btn btn-primary">Pronto</button></form>';
    dialog.addEventListener('close',()=>{dialog.remove();document.getElementById('sound-button')?.focus();});
    document.body.append(dialog);status(message||'Ative a música para ouvir.');dialog.showModal();
  }
  document.addEventListener('pointerdown',ev=>{unlocked=true;update();if(ev.target.closest('button,[role=button]'))cue('tap');},{passive:true});
  document.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){unlocked=true;update();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)context?.suspend();update();});
  return {set,cue,open,label};
})();
