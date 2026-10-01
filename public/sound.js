/* Original procedural score for ConectAí. No samples, tracking or external service. */
const Sound = (() => {
  const defaults = { music: false, effects: false, volume: .35 };
  let prefs = { ...defaults }, context, master, musicBus, effectsBus, timer, next = 0, step = 0, unlocked = false;
  try { const saved = JSON.parse(localStorage.getItem('conectai-sound')); if (saved) prefs = { music: saved.music === true, effects: saved.effects === true, volume: Number.isFinite(saved.volume) ? Math.max(0,Math.min(1,saved.volume)) : .35 }; } catch { /* optional persistence */ }
  // Four original phrases, in C major; gentle toy-piano timbre at 88 bpm.
  const melody = [76,null,79,81,79,76,74,null, 72,76,79,null,74,76,72,null,
    77,null,81,79,77,76,72,null, 74,77,81,null,79,76,74,null,
    74,null,77,81,84,81,77,null, 76,74,72,null,74,77,76,null,
    79,null,83,81,79,77,74,null, 76,79,74,null,72,null,null,null];
  const harmony = [[48,60,64,67],[53,60,65,69],[50,62,65,69],[55,62,67,71]];
  const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
  function voice(midi, at, duration, gain, bus, type = 'sine') {
    const osc = context.createOscillator(), envelope = context.createGain();
    osc.type = type; osc.frequency.value = frequency(midi);
    envelope.gain.setValueAtTime(0, at); envelope.gain.linearRampToValueAtTime(gain, at + .015);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    osc.connect(envelope); envelope.connect(bus); osc.start(at); osc.stop(at + duration + .03);
    osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
  }
  function ensure() {
    if (!context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return false;
      context = new Audio(); master = context.createGain(); master.connect(context.destination);
      musicBus = context.createGain(); musicBus.connect(master); effectsBus = context.createGain(); effectsBus.connect(master);
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
    master.gain.setTargetAtTime(prefs.volume, context.currentTime, .03);
    musicBus.gain.setTargetAtTime(prefs.music ? .20 : 0, context.currentTime, .06);
    effectsBus.gain.setTargetAtTime(prefs.effects ? .24 : 0, context.currentTime, .02);
    return true;
  }
  function schedule() {
    if (!context || !prefs.music || document.hidden) return;
    while (next < context.currentTime + .4) {
      const note = melody[step % melody.length];
      if (note !== null) { voice(note, next, .65, .26, musicBus, 'triangle'); voice(note + 12, next, .3, .035, musicBus); }
      if (step % 8 === 0) {
        const chord = harmony[Math.floor(step / 16) % 4];
        voice(chord[0], next, 1.3, .30, musicBus);
        chord.slice(1).forEach((n,i) => voice(n, next + .06 * i, 1.7, .10, musicBus));
      }
      next += 60 / 88 / 2; step++;
    }
  }
  function update() {
    if (!unlocked || document.hidden || (!prefs.music && !prefs.effects && !context)) return;
    if (!ensure()) return;
    if (prefs.music && !timer) { next = context.currentTime + .05; timer = setInterval(schedule, 180); schedule(); }
    if (!prefs.music && timer) { clearInterval(timer); timer = null; }
  }
  let lastCue = 0;
  function cue(name) {
    if (!unlocked || !prefs.effects || document.hidden || !ensure()) return;
    if (context.currentTime - lastCue < .06) return;
    lastCue = context.currentTime;
    const notes = { tap: [79], answer: [72,76], success: [72,76,79,84], error: [74,72], result: [72,76,79,81,84], join: [67,72,76], warning: [72,69] }[name] || [79];
    notes.forEach((n,i) => voice(n, context.currentTime + .015 + i * .10, name === 'tap' ? .1 : .4, name === 'tap' ? .20 : .34, effectsBus));
  }
  function set(key, value) {
    prefs[key] = key === 'volume' ? Math.max(0,Math.min(1,Number(value))) : Boolean(value);
    unlocked = true; update();
    try { localStorage.setItem('conectai-sound', JSON.stringify(prefs)); } catch { /* optional */ }
    const button = document.getElementById('sound-button'); if (button) button.textContent = label();
    if (key === 'effects' && value) cue('success');
  }
  function label() { return prefs.music || prefs.effects ? 'Som ligado' : 'Som desligado'; }
  function open() {
    const dialog = document.createElement('dialog'); dialog.setAttribute('aria-labelledby','sound-title');
    dialog.innerHTML = `<h2 id="sound-title">Som do seu jeito</h2><p>Uma trilha leve para acompanhar a conversa.</p><label class="sound-option"><span>Música de fundo</span><input type="checkbox" ${prefs.music?'checked':''} onchange="Sound.set('music',this.checked)"></label><label class="sound-option"><span>Efeitos do jogo</span><input type="checkbox" ${prefs.effects?'checked':''} onchange="Sound.set('effects',this.checked)"></label><label class="sound-volume" for="sound-volume">Volume</label><input id="sound-volume" type="range" min="0" max="1" step=".05" value="${prefs.volume}" oninput="Sound.set('volume',this.value)"><p class="hint">A música pausa quando você sai desta aba.</p><form method="dialog"><button class="btn btn-primary">Pronto</button></form>`;
    dialog.addEventListener('close', () => { dialog.remove(); document.getElementById('sound-button')?.focus(); });
    document.body.append(dialog); dialog.showModal();
  }
  document.addEventListener('pointerdown', event => { unlocked = true; update(); if (event.target.closest('button,[role=button]')) cue('tap'); }, {passive:true});
  document.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { unlocked = true; update(); } });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearInterval(timer); timer = null; context?.suspend(); }
    else update();
  });
  return { set, cue, open, label };
})();
