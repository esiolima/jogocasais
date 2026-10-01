/*
 * ConectAí — Desenvolvido por Plínio Augusto e Esio Lima.
 * © 2026 Todos os direitos reservados.
 */
const GENDER_EMOJI = { M: "🧑‍🦱", F: "👩" };

const RELATIONSHIP_TYPES = [
  { id: 'casal', label: 'Casal' },
  { id: 'amigos', label: 'Amigos' },
  { id: 'irmaos', label: 'Irmãos' },
  { id: 'pais_filhos', label: 'Pais e filhos' },
  { id: 'outro', label: 'Outro' },
];

const QUESTION_COUNTS = [20, 50, 75, 100];

let ws = null;

let S = {
  screen: 'home', // home | setupDupla | setupGrupo | setupDuelo | join | lobby | game | finished
  error: '',
  connError: '',
  roomCode: null,
  mode: null,
  coupleId: null,
  playerIndex: null,
  playerId: null,
  lobby: null,
  game: null,
  finished: null,
  themesCatalog: null,

  // formulário de criação
  formName: '',
  formGender: 'F',
  relationshipType: 'casal',
  groupFlavor: 'galera',
  themeId: 'aleatorio',
  rankingMode: false,
  tensionMode: false,
  questionCount: 20,
  customMode: false,
  customText: '',
  dueloCount: 10,
  dueloCountOptions: [10, 20, 33],

  // duelo em andamento
  dueloQuestions: null,
  dueloPhase: null, // 'setup' | 'guess'
  dueloLocalIndex: 0,
  dueloLastResult: null,
  dueloWaiting: false,

  // chat
  chatMessages: [],
  chatInput: '',
  chatOpen: false,

  // entrar em partida
  joinStep: 'code',
  joinCodeInput: '',
  joinLobby: null,
  joinTarget: null,
};

function connect() {
  const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
  ws = new WebSocket(proto + location.host);
  ws.addEventListener('open', () => { S.connError = ''; Boot.mark('connection'); render(); });
  ws.addEventListener('message', (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
    handleMessage(msg);
  });
  ws.addEventListener('close', () => { S.connError = 'A conexão foi encerrada. Volte ao início para criar ou entrar em outra sala.'; Boot.fail('A conexão com o servidor foi encerrada. Tente novamente.'); render(); });
}

function sendMsg(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  else setState({ error: 'Sem conexão com o servidor. Recarregue a página.' });
}

function setState(patch) { Object.assign(S, patch); render(); }

function handleMessage(msg) {
  msg = safeMessage(msg);
  switch (msg.type) {
    case 'error': setState({ error: msg.message }); break;
    case 'room_created':
    case 'joined':
      Sound.cue('join'); S.mode = msg.mode; S.roomCode = msg.code;
      if (msg.mode === 'dupla') { S.coupleId = msg.coupleId; S.playerIndex = msg.playerIndex; }
      else { S.playerId = msg.playerId; }
      setState({ screen: 'lobby', error: '' });
      break;
    case 'lookup_result':
      if (!msg.found) { setState({ error: 'Partida não encontrada. Confira o código.' }); return; }
      if (msg.started) { setState({ error: 'Esta partida já começou.' }); return; }
      setState({ joinLobby: msg, joinStep: 'details', error: '' });
      break;
    case 'lobby_state':
      S.lobby = msg;
      if (S.screen === 'lobby') render();
      break;
    case 'game_state':
      if ((msg.revealed || msg.allVoted) && !(S.game?.questionIndex === msg.questionIndex && (S.game.revealed || S.game.allVoted))) Sound.cue(msg.skipped ? 'warning' : (msg.match || (msg.allVoted && !msg.tie)) ? 'success' : 'error');
      S.game = msg; S.screen = 'game'; render();
      break;
    case 'game_finished':
      Sound.cue('result'); S.finished = msg; S.screen = 'finished'; render();
      break;
    case 'duelo_setup':
      S.dueloQuestions = msg.questions; S.dueloPhase = 'setup'; S.dueloLocalIndex = 0;
      S.dueloWaiting = false; S.screen = 'game'; render();
      break;
    case 'duelo_guess_start':
      S.dueloQuestions = msg.questions; S.dueloPhase = 'guess'; S.dueloLocalIndex = 0;
      S.dueloWaiting = false; S.dueloLastResult = null; render();
      break;
    case 'duelo_guess_result':
      Sound.cue(msg.correct ? 'success' : 'error');
      S.dueloLastResult = { correct: msg.correct, actualChoice: msg.actualChoice };
      render();
      break;
    case 'duelo_waiting':
      S.dueloWaiting = true; render();
      break;
    case 'chat_message':
      S.chatMessages.push(msg);
      if (S.chatMessages.length > 100) S.chatMessages.shift();
      render();
      break;
    case 'kicked':
      alert(msg.message);
      resetToHome();
      break;
  }
}

/* ---------- Ações ---------- */

function parseCustomQuestions() {
  return S.customText.split('\n').map((l) => l.trim()).filter(Boolean);
}

function actionCreateDupla() {
  if (!S.formName.trim()) { setState({ error: 'Digite seu nome.' }); return; }
  const customQuestions = S.customMode ? parseCustomQuestions() : null;
  if (S.customMode && customQuestions.length === 0) { setState({ error: 'Digite pelo menos uma pergunta personalizada.' }); return; }
  sendMsg({
    type: 'create_room', mode: 'dupla', name: S.formName.trim(), gender: S.formGender,
    relationshipType: S.relationshipType, themeId: S.themeId,
    rankingMode: S.rankingMode, tensionMode: S.tensionMode,
    questionCount: S.customMode ? Math.min(customQuestions.length, 200) : S.questionCount,
    customQuestions,
  });
}

function actionCreateGrupo() {
  if (!S.formName.trim()) { setState({ error: 'Digite seu nome.' }); return; }
  const customQuestions = S.customMode ? parseCustomQuestions() : null;
  if (S.customMode && customQuestions.length === 0) { setState({ error: 'Digite pelo menos uma pergunta personalizada.' }); return; }
  sendMsg({
    type: 'create_room', mode: 'grupo', name: S.formName.trim(),
    flavor: S.groupFlavor, tensionMode: S.tensionMode,
    questionCount: S.customMode ? Math.min(customQuestions.length, 200) : S.questionCount,
    customQuestions,
  });
}

function actionCreateDuelo() {
  if (!S.formName.trim()) { setState({ error: 'Digite seu nome.' }); return; }
  sendMsg({ type: 'create_room', mode: 'duelo', name: S.formName.trim(), questionCount: S.dueloCount });
}

function actionDueloAnswer(index, choice) {
  sendMsg({ type: 'setup_answer', index, choice });
  S.dueloLocalIndex += 1;
  render();
}

function actionDueloGuess(index, choice) {
  sendMsg({ type: 'guess_answer', index, choice });
}

function actionDueloNext() {
  S.dueloLocalIndex += 1;
  S.dueloLastResult = null;
  render();
}

function actionSendChat() {
  const text = S.chatInput.trim();
  if (!text) return;
  sendMsg({ type: 'chat_send', text });
  S.chatInput = '';
  render();
}

function actionLeave() {
  if (!confirm('Tem certeza que quer sair da partida?')) return;
  sendMsg({ type: 'leave' });
  resetToHome();
}

function actionLookupRoom() {
  const code = S.joinCodeInput.trim().toUpperCase();
  if (code.length < 4) { setState({ error: 'Digite o código da partida.' }); return; }
  S.roomCode = code;
  sendMsg({ type: 'lookup_room', code });
}

function actionJoinRoom() {
  if (!S.formName.trim()) { setState({ error: 'Digite seu nome.' }); return; }
  if (S.joinLobby.mode === 'dupla' && !S.joinTarget) { setState({ error: 'Escolha uma opção.' }); return; }
  sendMsg({ type: 'join_room', code: S.roomCode, name: S.formName.trim(), gender: S.formGender, target: S.joinTarget === '__new__' ? 'new' : S.joinTarget });
}

function actionStartGame() { sendMsg({ type: 'start_game' }); }
function actionAnswer(choice) { Sound.cue('answer'); sendMsg({ type: 'answer', choice }); }
function actionVote(targetId) { Sound.cue('answer'); sendMsg({ type: 'vote', targetId }); }
function actionReady() { sendMsg({ type: 'ready' }); }
async function copyCode() {
  try { await navigator.clipboard.writeText(S.roomCode); setState({ copyStatus: 'Código copiado!' }); }
  catch { setState({ copyStatus: 'Selecione o código acima para copiar.' }); }
}

function resetToHome() {
  S = Object.assign(S, {
    screen: 'home', error: '', roomCode: null, mode: null, coupleId: null, playerIndex: null, playerId: null,
    lobby: null, game: null, finished: null, formName: '', formGender: 'F', relationshipType: 'casal',
    groupFlavor: 'galera', themeId: 'aleatorio', rankingMode: false, tensionMode: false, questionCount: 20,
    customMode: false, customText: '', joinStep: 'code', joinCodeInput: '', joinLobby: null, joinTarget: null,
    dueloQuestions: null, dueloPhase: null, dueloLocalIndex: 0, dueloLastResult: null, dueloWaiting: false,
    chatMessages: [], chatInput: '', chatOpen: false,
  });
  render();
}

/* ---------- Render helpers ---------- */

function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function safeMessage(value) {
  if (typeof value === 'string') return escapeHTML(value);
  if (Array.isArray(value)) return value.map(safeMessage);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, safeMessage(v)]));
  return value;
}
let lastScreen = '';
let lastRound = '';
function render() {
  const root = document.getElementById('app');
  const focused = document.activeElement;
  const focusKey = root.contains(focused) ? focused.getAttribute('oninput') || focused.getAttribute('onclick') : null;
  const selection = focused && 'selectionStart' in focused ? [focused.selectionStart, focused.selectionEnd] : null;
  const changed = lastScreen !== S.screen;
  const round = S.screen === 'game' ? `${S.mode}:${S.game?.questionIndex}:${S.dueloPhase}:${S.dueloLocalIndex}` : '';
  const newRound = round && round !== lastRound;
  document.body.dataset.screen = S.screen;
  document.body.dataset.mode = S.mode || S.screen;
  const previousMascot = root.querySelector('.mascot');
  root.innerHTML = UI.shell(S, renderScreen());
  Mascot.mount(root, S, previousMascot);
  UI.enhance(root);
  if (S.copyStatus && S.screen === 'lobby') {
    const code = root.querySelector('.code-box');
    code?.insertAdjacentHTML('afterend', `<p role="status" class="muted">${S.copyStatus}</p>`);
  }
  if (focusKey && !changed && !newRound) {
    const target = [...root.querySelectorAll('[oninput],[onclick]')].find(el => el.getAttribute('oninput') === focusKey || el.getAttribute('onclick') === focusKey);
    target?.focus({preventScroll:true});
    if (selection && target?.setSelectionRange) target.setSelectionRange(...selection);
  } else if ((changed && lastScreen) || newRound) { root.querySelector('h1')?.focus({preventScroll:true}); window.scrollTo(0,0); }
  lastScreen = S.screen;
  lastRound = round;
}

function chatPanel() {
  const msgs = S.chatMessages.map((m) => `<div class="chat-msg"><b>${m.name}:</b> ${m.text}</div>`).join('');
  return `
    <div class="card chat-panel">
      <h3 style="font-size:14px; color:var(--ink-soft); margin-bottom:8px;">💬 CHAT</h3>
      <div class="chat-messages" id="chatMessages">${msgs || '<p class="muted" style="font-size:13px;">Nenhuma mensagem ainda.</p>'}</div>
      <div class="chat-input-row">
        <input type="text" value="${escapeHTML(S.chatInput)}" oninput="S.chatInput=this.value" onkeydown="if(event.key==='Enter'){actionSendChat();}" placeholder="Escreva algo...">
        <button class="btn btn-secondary" style="width:auto; margin:0; padding:10px 16px;" onclick="actionSendChat()">Enviar</button>
      </div>
    </div>
  `;
}

function logoBlock() {
  return '';
}
function errBlock() { return S.error ? `<div class="error-box">${S.error}</div>` : ''; }
function connErrBlock() { return S.connError ? `<div class="error-box">${S.connError}</div>` : ''; }

function renderScreen() {
  if (S.connError) return `${connErrBlock()}<button class="btn btn-primary" onclick="location.reload()">Voltar ao início</button>`;
  switch (S.screen) {
    case 'home': return screenHome();
    case 'setupDupla': return screenSetupDupla();
    case 'setupGrupo': return screenSetupGrupo();
    case 'setupDuelo': return screenSetupDuelo();
    case 'join': return screenJoin();
    case 'lobby': return screenLobby();
    case 'game':
      if (S.mode === 'duelo') return screenGameDuelo();
      return S.game && S.game.mode === 'grupo' ? screenGameGrupo() : screenGameDupla();
    case 'finished':
      if (S.finished && S.finished.mode === 'duelo') return screenFinishedDuelo();
      return S.finished && S.finished.mode === 'grupo' ? screenFinishedGrupo() : screenFinishedDupla();
    default: return screenHome();
  }
}

/* ---------- Tela inicial ---------- */

function screenHome() {
  return `
    ${errBlock()}
    <p class="eyebrow">ESCOLHA SEU JEITO DE JOGAR</p>
    <button class="mode-card mode-dupla" onclick="setState({screen:'setupDupla', error:''})"><span class="mode-number">01</span><span><strong>Modo Duplas</strong><small>Quem é mais provável? Testem a sintonia.</small><em>4 a 12 pessoas · de 2 a 6 duplas</em></span><span class="mode-arrow" aria-hidden="true">↗</span></button>
    <button class="mode-card mode-grupo" onclick="setState({screen:'setupGrupo', error:''})"><span class="mode-number">02</span><span><strong>Família / Galera</strong><small>Uma pergunta. Todo mundo tem um nome.</small><em>3 a 6 pessoas · votação em grupo</em></span><span class="mode-arrow" aria-hidden="true">↗</span></button>
    <button class="mode-card mode-duelo" onclick="setState({screen:'setupDuelo', error:''})"><span class="mode-number">03</span><span><strong>Duelo</strong><small>Será que você adivinha minhas respostas?</small><em>2 pessoas · quiz de preferências</em></span><span class="mode-arrow" aria-hidden="true">↗</span></button>
    <div class="join-invite"><span>Já recebeu um código?</span><button class="btn btn-secondary" onclick="setState({screen:'join', joinStep:'code', joinCodeInput:'', error:'', formName:'', formGender:'F', joinTarget:null})">Entrar em uma partida <span aria-hidden="true">→</span></button></div>
    <p class="home-note">Sem cadastro. Cada pessoa joga no seu aparelho.</p>
  `;
}

function genderPicker() {
  return `
    <label class="field-label">Seu gênero</label>
    <div class="gender-row">
      <div class="gender-opt ${S.formGender === 'F' ? 'selected' : ''}" onclick="setState({formGender:'F'})"><span class="emoji">👩</span>Feminino</div>
      <div class="gender-opt ${S.formGender === 'M' ? 'selected' : ''}" onclick="setState({formGender:'M'})"><span class="emoji">🧑‍🦱</span>Masculino</div>
    </div>
  `;
}

function questionCountPicker() {
  let options = QUESTION_COUNTS;
  if (S.screen === 'setupDupla' && S.themeId !== 'aleatorio') {
    const theme = (S.themesCatalog || []).find((t) => t.id === S.themeId);
    const max = theme ? theme.total : 25;
    options = [Math.min(20, max), max].filter((n, i, arr) => arr.indexOf(n) === i);
    if (S.questionCount > max || !options.includes(S.questionCount)) S.questionCount = max;
  }
  if (!options.includes(S.questionCount)) S.questionCount = options[0];
  return `
    <label class="field-label">Quantidade de perguntas</label>
    <div class="chip-row">
      ${options.map((n) => `<div class="chip ${S.questionCount === n ? 'selected' : ''}" onclick="setState({questionCount:${n}})">${n}</div>`).join('')}
    </div>
  `;
}

function customToggle() {
  return `
    <div class="toggle-row">
      <span class="toggle-label">✍️ Modo personalizado (digitar minhas perguntas)</span>
      <div class="switch ${S.customMode ? 'on' : ''}" onclick="setState({customMode: ${!S.customMode}})"><div class="knob"></div></div>
    </div>
    ${S.customMode ? `
      <label class="field-label">Suas perguntas (uma por linha)</label>
      <textarea oninput="S.customText=this.value" placeholder="Quem é mais organizado?\nQuem cozinha melhor?">${escapeHTML(S.customText)}</textarea>
      <p class="hint">A quantidade de perguntas será igual ao número de linhas preenchidas.</p>
    ` : ''}
  `;
}

/* ---------- Configuração: Modo Dupla ---------- */

function screenSetupDupla() {
  return `
    ${logoBlock()}
    <div class="card">
      <label class="field-label">Seu nome</label>
      <input type="text" value="${escapeHTML(S.formName)}" oninput="S.formName=this.value" placeholder="Ex: Plínio">
      ${genderPicker()}

      <label class="field-label">Tipo de dupla</label>
      <div class="chip-row">
        ${RELATIONSHIP_TYPES.map((r) => `<div class="chip ${S.relationshipType === r.id ? 'selected' : ''}" onclick="setState({relationshipType:'${r.id}'})">${r.label}</div>`).join('')}
      </div>

      ${!S.customMode ? `
        <label class="field-label">Tema</label>
        <div class="chip-row">
          <div class="chip ${S.themeId === 'aleatorio' ? 'selected' : ''}" onclick="setState({themeId:'aleatorio'})">🎲 Aleatório</div>
          ${(S.themesCatalog || []).map((t) => `<div class="chip ${S.themeId === t.id ? 'selected' : ''}" onclick="setState({themeId:'${t.id}'})">${t.icon} ${t.name}</div>`).join('')}
        </div>
        ${S.themeId === 'aleatorio' ? `
          <div class="toggle-row">
            <span class="toggle-label">📊 Modo Ranking <span class="info-icon" onclick="setState({showRankingInfo: ${!S.showRankingInfo}})">?</span></span>
            <div class="switch ${S.rankingMode ? 'on' : ''}" onclick="setState({rankingMode: ${!S.rankingMode}})"><div class="knob"></div></div>
          </div>
          ${S.showRankingInfo ? `<div class="tooltip-box">Nesse modo, cada tema vale uma certa quantidade de pontos — o tema mais difícil é o mais valioso. Vence quem tiver a maior soma de pontos.
            <table class="ranking-table">${(S.themesCatalog || []).map((t) => `<tr><td>${t.icon} ${t.name}</td><td style="text-align:right;">${t.rankingPoints} pt(s)</td></tr>`).join('')}</table>
          </div>` : ''}
          <div class="toggle-row">
            <span class="toggle-label">🔥 Modo Tensão <span class="info-icon" onclick="setState({showTensionInfo: ${!S.showTensionInfo}})">?</span></span>
            <div class="switch ${S.tensionMode ? 'on' : ''}" onclick="setState({tensionMode: ${!S.tensionMode}})"><div class="knob"></div></div>
          </div>
          ${S.showTensionInfo ? `<div class="tooltip-box">Perguntas mais ousadas e capciosas de todos os temas — clima de tensão do início ao fim.</div>` : ''}
          ${!S.tensionMode ? `<p class="hint">As perguntas de tensão continuam podendo aparecer misturadas no sorteio, valendo 1 ponto a mais se a dupla acertar.</p>` : ''}
        ` : ''}
        ${questionCountPicker()}
      ` : ''}

      ${customToggle()}
      ${!S.customMode ? '<p class="hint">A partida pode ser menor se faltarem perguntas distintas no tema escolhido.</p>' : ''}
      ${errBlock()}
      <button class="btn btn-primary" onclick="actionCreateDupla()">CRIAR PARTIDA</button>
      <button class="btn btn-ghost" onclick="setState({screen:'home', error:''})">Voltar</button>
    </div>
  `;
}

function screenSetupDuelo() {
  return `
    ${logoBlock()}
    <div class="card">
      <label class="field-label">Seu nome</label>
      <input type="text" value="${escapeHTML(S.formName)}" oninput="S.formName=this.value" placeholder="Seu nome">
      <label class="field-label">Quantidade de perguntas</label>
      <div class="chip-row">
        ${S.dueloCountOptions.map((n) => `<div class="chip ${S.dueloCount === n ? 'selected' : ''}" onclick="setState({dueloCount:${n}})">${n}</div>`).join('')}
      </div>
      ${errBlock()}
      <button class="btn btn-primary" onclick="actionCreateDuelo()">CRIAR PARTIDA</button>
      <button class="btn btn-ghost" onclick="setState({screen:'home', error:''})">Voltar</button>
      <p class="hint" style="text-align:center;">Fase 1: cada um responde sobre si mesmo, em segredo.<br>Fase 2: tentem adivinhar a resposta um do outro!</p>
    </div>
  `;
}

function screenSetupGrupo() {
  return `
    ${logoBlock()}
    <div class="card">
      <label class="field-label">Seu nome</label>
      <input type="text" value="${escapeHTML(S.formName)}" oninput="S.formName=this.value" placeholder="Seu nome">

      <label class="field-label">Tipo de grupo</label>
      <div class="chip-row">
        <div class="chip ${S.groupFlavor === 'familia' ? 'selected' : ''}" onclick="setState({groupFlavor:'familia'})">👨‍👩‍👧 Família</div>
        <div class="chip ${S.groupFlavor === 'galera' ? 'selected' : ''}" onclick="setState({groupFlavor:'galera'})">🎉 Galera</div>
      </div>

      ${!S.customMode ? `
        <div class="toggle-row">
          <span class="toggle-label">🔥 Modo Tensão <span class="info-icon" onclick="setState({showTensionInfo: ${!S.showTensionInfo}})">?</span></span>
          <div class="switch ${S.tensionMode ? 'on' : ''}" onclick="setState({tensionMode: ${!S.tensionMode}})"><div class="knob"></div></div>
        </div>
        ${S.showTensionInfo ? `<div class="tooltip-box">Perguntas mais ousadas e capciosas — clima de tensão do início ao fim.</div>` : ''}
        ${questionCountPicker()}
      ` : ''}

      ${customToggle()}
      ${!S.customMode ? '<p class="hint">A partida pode ser menor se faltarem perguntas distintas no tema escolhido.</p>' : ''}
      ${errBlock()}
      <button class="btn btn-primary" onclick="actionCreateGrupo()">CRIAR PARTIDA</button>
      <button class="btn btn-ghost" onclick="setState({screen:'home', error:''})">Voltar</button>
      <p class="hint" style="text-align:center;">São necessárias pelo menos 3 pessoas (até 6) para começar.</p>
    </div>
  `;
}

/* ---------- Entrar em partida ---------- */

function screenJoin() {
  if (S.joinStep === 'code') {
    return `
      ${logoBlock()}
      <div class="card">
        <label class="field-label">Código da partida</label>
        <input type="text" style="text-transform:uppercase; text-align:center; letter-spacing:4px; font-family:'Baloo 2'; font-size:22px;" value="${escapeHTML(S.joinCodeInput)}" oninput="S.joinCodeInput=this.value.toUpperCase()" placeholder="K7P2XM" maxlength="6">
        ${errBlock()}
        <button class="btn btn-primary" onclick="actionLookupRoom()">CONTINUAR</button>
        <button class="btn btn-ghost" onclick="setState({screen:'home', error:''})">Voltar</button>
      </div>
    `;
  }

  const lobby = S.joinLobby;
  if (lobby.mode === 'dupla') {
    const openCouples = lobby.couples.filter((c) => !c.complete);
    const canNew = lobby.couples.length < lobby.maxCouples;
    let options = openCouples.map((c) => `
      <div class="gender-opt ${S.joinTarget === c.id ? 'selected' : ''}" style="text-align:left; display:flex; align-items:center; gap:10px;" onclick="setState({joinTarget:'${c.id}'})">
        <span class="emoji" style="font-size:20px;">${GENDER_EMOJI[c.players[0].gender]}</span>
        Entrar como parceiro(a) de <b>&nbsp;${c.players[0].name}</b>
      </div>
    `).join('');
    if (canNew) options += `<div class="gender-opt ${S.joinTarget === '__new__' ? 'selected' : ''}" style="text-align:left;" onclick="setState({joinTarget:'__new__'})">➕ Criar nova dupla</div>`;
    if (!options) options = `<p class="muted">Esta partida já está cheia.</p>`;

    return `
      ${logoBlock()}
      <div class="card">
        <p class="muted" style="margin-bottom:14px;">Partida <b>${lobby.code}</b> — Modo Duplas · 4 a 12 pessoas</p>
        <label class="field-label">Seu nome</label>
        <input type="text" value="${escapeHTML(S.formName)}" oninput="S.formName=this.value" placeholder="Seu nome">
        ${genderPicker()}
        <label class="field-label">Escolha uma opção</label>
        <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px;">${options}</div>
        ${errBlock()}
        <button class="btn btn-primary" onclick="actionJoinRoom()">ENTRAR</button>
        <button class="btn btn-ghost" onclick="setState({screen:'home', error:''})">Voltar</button>
      </div>
    `;
  }

  if (lobby.mode === 'grupo') {
    const full = lobby.players.length >= lobby.maxPlayers;
    return `
      ${logoBlock()}
      <div class="card">
        <p class="muted" style="margin-bottom:14px;">Partida <b>${lobby.code}</b> — Modo ${lobby.flavor === 'familia' ? 'Família' : 'Galera'}</p>
        <label class="field-label">Seu nome</label>
        <input type="text" value="${escapeHTML(S.formName)}" oninput="S.formName=this.value" placeholder="Seu nome">
        ${full ? '<p class="muted">Esta partida já está cheia.</p>' : ''}
        ${errBlock()}
        <button class="btn btn-primary" ${full ? 'disabled' : ''} onclick="actionJoinRoom()">ENTRAR</button>
        <button class="btn btn-ghost" onclick="setState({screen:'home', error:''})">Voltar</button>
      </div>
    `;
  }

  // duelo
  const full = lobby.players.length >= 2;
  return `
    ${logoBlock()}
    <div class="card">
      <p class="muted" style="margin-bottom:14px;">Partida <b>${lobby.code}</b> — Modo Duelo</p>
      <label class="field-label">Seu nome</label>
      <input type="text" value="${escapeHTML(S.formName)}" oninput="S.formName=this.value" placeholder="Seu nome">
      ${full ? '<p class="muted">Esta partida já está cheia.</p>' : ''}
      ${errBlock()}
      <button class="btn btn-primary" ${full ? 'disabled' : ''} onclick="actionJoinRoom()">ENTRAR</button>
      <button class="btn btn-ghost" onclick="setState({screen:'home', error:''})">Voltar</button>
    </div>
  `;
}

/* ---------- Lobby ---------- */

function screenLobby() {
  const lobby = S.lobby;
  if (!lobby) return `${logoBlock()}<p class="muted">Carregando sala...</p>`;

  if (lobby.mode === 'dupla') {
    const iAmHost = lobby.hostCoupleId === S.coupleId && S.playerIndex === 0;
    const completeCount = lobby.couples.filter((c) => c.complete).length;
    const minCouples = lobby.minCouples || 2;
    const readyToStart = completeCount >= minCouples && completeCount === lobby.couples.length;
    const rows = lobby.couples.map((c) => {
      const names = c.players.map((p) => `${GENDER_EMOJI[p.gender]} ${p.name}`).join(' &nbsp;+&nbsp; ');
      return `<div class="couple-row ${c.complete ? 'complete' : ''}"><span>${names}${c.complete ? '' : ' <span class="muted">(aguardando parceiro)</span>'}</span><span class="pill ${c.complete ? 'ok' : 'wait'}">${c.complete ? 'Completo' : 'Incompleto'}</span></div>`;
    }).join('');
    return `
      ${logoBlock()}
      <div class="card">
        <p class="muted">Compartilhe este código:</p>
        <div class="code-box">${lobby.code}</div>
        <button class="btn btn-secondary" onclick="copyCode()">COPIAR CÓDIGO</button>
        <h3 style="margin:18px 0 10px; font-size:16px; color:var(--ink-soft);">Duplas na sala (${lobby.couples.length}/${lobby.maxCouples}) · ${lobby.questionCount} pergunta${lobby.questionCount === 1 ? '' : 's'}</h3>
        ${rows}
        ${errBlock()}
        <p class="hint">4 a 12 pessoas · de 2 a 6 duplas. ${completeCount < minCouples ? 'Formem pelo menos 2 duplas completas para começar.' : !readyToStart ? 'Falta completar as duplas que estão aguardando parceiro.' : 'Todas as duplas estão prontas!'}</p>
        ${iAmHost ? `<button class="btn btn-primary" ${!readyToStart ? 'disabled' : ''} onclick="actionStartGame()">INICIAR JOGO</button>` : `<p class="muted">Aguardando o organizador iniciar a partida...</p>`}
        <button class="btn btn-ghost" onclick="actionLeave()">Sair da dupla</button>
      </div>
      ${chatPanel()}
    `;
  }

  const iAmHost = lobby.hostId === S.playerId;
  const rows = lobby.players.map((p) => `<div class="couple-row complete"><span>👤 ${p.name}</span></div>`).join('');

  if (lobby.mode === 'grupo') {
    return `
      ${logoBlock()}
      <div class="card">
        <p class="muted">Compartilhe este código:</p>
        <div class="code-box">${lobby.code}</div>
        <button class="btn btn-secondary" onclick="copyCode()">COPIAR CÓDIGO</button>
        <h3 style="margin:18px 0 10px; font-size:16px; color:var(--ink-soft);">Pessoas na sala (${lobby.players.length}/${lobby.maxPlayers}) · ${lobby.questionCount} pergunta${lobby.questionCount === 1 ? '' : 's'}</h3>
        ${rows}
        ${errBlock()}
        ${iAmHost
          ? `<button class="btn btn-primary" ${lobby.players.length < 3 ? 'disabled' : ''} onclick="actionStartGame()">INICIAR JOGO</button>
             ${lobby.players.length < 3 ? '<p class="hint" style="text-align:center;">Mínimo de 3 pessoas para começar.</p>' : ''}`
          : `<p class="muted">Aguardando o organizador iniciar a partida...</p>`}
        <button class="btn btn-ghost" onclick="actionLeave()">Sair da partida</button>
      </div>
      ${chatPanel()}
    `;
  }

  // duelo
  return `
    ${logoBlock()}
    <div class="card">
      <p class="muted">Compartilhe este código:</p>
      <div class="code-box">${lobby.code}</div>
      <button class="btn btn-secondary" onclick="copyCode()">COPIAR CÓDIGO</button>
      <h3 style="margin:18px 0 10px; font-size:16px; color:var(--ink-soft);">Jogadores (${lobby.players.length}/2) · ${lobby.questionCount} pergunta${lobby.questionCount === 1 ? '' : 's'}</h3>
      ${rows}
      ${errBlock()}
      ${iAmHost
        ? `<button class="btn btn-primary" ${lobby.players.length < 2 ? 'disabled' : ''} onclick="actionStartGame()">INICIAR DUELO</button>`
        : `<p class="muted">Aguardando o organizador iniciar a partida...</p>`}
      <button class="btn btn-ghost" onclick="actionLeave()">Sair da partida</button>
    </div>
    ${chatPanel()}
  `;
}

/* ---------- Jogo: Modo Dupla ---------- */

function themeTag(g) { return `<div style="text-align:center;"><span class="theme-tag">${g.themeIcon || '💬'} ${g.themeName || ''}</span></div>`; }

function scoreBoardHTML(game) {
  const lines = game.scoreboard.map((c) => `<div class="score-line ${c.mine ? 'me' : ''}"><span>${c.names}</span><span>${c.score}</span></div>`).join('');
  return `<div class="score-board"><h3>PLACAR</h3>${lines}</div>`;
}

function screenGameDupla() {
  const g = S.game;
  if (g.incomplete) return `${logoBlock()}<div class="card"><p class="muted">Sua dupla está incompleta. Peça para seu parceiro entrar na sala antes do próximo jogo.</p></div>`;

  let body = '';
  if (!g.revealed) {
    if (g.myAnswer === null) {
      body = `
        <div class="choice-row">
          <div class="choice-card eu" onclick="actionAnswer('EU')"><span class="avatar">${GENDER_EMOJI[g.myGender]}</span>EU</div>
          <div class="choice-card voce" onclick="actionAnswer('VOCE')"><span class="avatar">${GENDER_EMOJI[g.partnerGender]}</span>VOCÊ</div>
        </div>
        <button class="btn btn-ghost" style="text-align:center;" onclick="actionAnswer('PULAR')">⏭️ Pular pergunta</button>
        <p class="status-banner">Quem você acha?</p>
      `;
    } else {
      body = `
        <div class="choice-row">
          <div class="choice-card eu locked"><span class="avatar">${GENDER_EMOJI[g.myGender]}</span>EU</div>
          <div class="choice-card voce locked"><span class="avatar">${GENDER_EMOJI[g.partnerGender]}</span>VOCÊ</div>
        </div>
        <p class="status-banner">${g.myAnswer === 'PULAR' ? 'Você pulou essa pergunta.' : 'Resposta registrada.'}<br>Aguardando ${g.partnerName}...</p>
      `;
    }
  } else if (g.skipped) {
    body = `
      <div class="result-banner nomatch">⏭️ Pergunta pulada — ninguém marca ponto.</div>
      ${g.myReady ? `<p class="status-banner">Aguardando ${g.partnerName} confirmar...</p>` : `<button class="btn btn-primary" onclick="actionReady()">PRÓXIMA</button>`}
    `;
  } else {
    body = `
      <div class="reveal-row">
        <div class="reveal-card"><div class="name">Você</div><div class="ans">${g.myAnswer === 'EU' ? 'EU' : 'VOCÊ'}</div></div>
        <div class="reveal-card"><div class="name">${g.partnerName}</div><div class="ans">${g.partnerAnswer === 'EU' ? 'EU' : 'VOCÊ'}</div></div>
      </div>
      <div class="result-banner ${g.match ? 'match' : 'nomatch'}">${g.match ? `Conexão detectada! 🎉 (+${g.questionValue})` : 'Desconexão!'}</div>
      ${g.myReady ? `<p class="status-banner">Aguardando ${g.partnerName} confirmar...</p>` : `<button class="btn btn-primary" onclick="actionReady()">PRÓXIMA</button>`}
    `;
  }

  return `
    ${logoBlock()}
    <div class="progress">PERGUNTA ${g.questionIndex + 1} DE ${g.totalQuestions}</div>
    ${themeTag(g)}
    <div class="question-card"><p>${g.questionText}</p></div>
    ${body}
    ${scoreBoardHTML(g)}
    <button class="btn btn-ghost" onclick="actionLeave()">Sair da dupla</button>
    ${chatPanel()}
  `;
}

/* ---------- Jogo: Modo Grupo ---------- */

function screenGameGrupo() {
  const g = S.game;
  let body = '';

  if (!g.allVoted) {
    if (g.myVote === null) {
      body = `
        <div style="margin-bottom:16px;">
          ${g.players.map((p) => `<div class="person-vote" onclick="actionVote('${p.id}')">${p.name}</div>`).join('')}
        </div>
        <button class="btn btn-ghost" style="text-align:center;" onclick="actionVote('PULAR')">⏭️ Pular pergunta</button>
        <p class="status-banner">Escolha uma pessoa do grupo</p>
      `;
    } else {
      body = `<p class="status-banner">${g.myVote === 'PULAR' ? 'Você pulou essa pergunta.' : 'Voto registrado!'}<br>Aguardando os outros (${g.votedCount}/${g.totalPlayers}) votarem...</p>`;
    }
  } else if (g.skipped) {
    body = `
      <div class="result-banner nomatch">⏭️ Pergunta pulada — ninguém marca ponto.</div>
      ${g.myReady ? `<p class="status-banner">Aguardando os outros confirmarem... (${g.readyCount}/${g.totalPlayers})</p>` : `<button class="btn btn-primary" onclick="actionReady()">PRÓXIMA</button>`}
    `;
  } else {
    const rows = g.tally.map((t) => `
      <div class="person-vote ${t.playerId === g.winnerId ? 'selected' : ''}">
        <span>${t.name}</span><span class="votes">${t.votes} voto${t.votes === 1 ? '' : 's'}</span>
      </div>
    `).join('');
    body = `
      ${rows}
      <div class="result-banner ${g.tie ? 'nomatch' : 'match'}">${g.tie ? 'Empate! Ninguém marca ponto nessa rodada.' : 'Conexão detectada! 🎉'}</div>
      ${g.myReady ? `<p class="status-banner">Aguardando os outros confirmarem... (${g.readyCount}/${g.totalPlayers})</p>` : `<button class="btn btn-primary" onclick="actionReady()">PRÓXIMA</button>`}
    `;
  }

  return `
    ${logoBlock()}
    <div class="progress">PERGUNTA ${g.questionIndex + 1} DE ${g.totalQuestions}</div>
    ${themeTag(g)}
    <div class="question-card"><p>${g.questionText}</p></div>
    ${body}
    <button class="btn btn-ghost" onclick="actionLeave()">Sair da partida</button>
    ${chatPanel()}
  `;
}

/* ---------- Jogo: Modo Duelo ---------- */

function screenGameDuelo() {
  if (!S.dueloQuestions) return `${logoBlock()}<p class="muted">Carregando...</p>`;
  const total = S.dueloQuestions.length;
  const i = S.dueloLocalIndex;
  const footer = `<button class="btn btn-ghost" onclick="actionLeave()">Sair da partida</button>${chatPanel()}`;

  if (i >= total) {
    return `${logoBlock()}<div class="card"><p class="muted">Aguardando o outro jogador terminar essa fase...</p></div>${footer}`;
  }

  const q = S.dueloQuestions[i];

  if (S.dueloPhase === 'setup') {
    return `
      ${logoBlock()}
      <div class="progress">FASE 1: SOBRE VOCÊ · ${i + 1} DE ${total}</div>
      <div class="question-card"><p>${q.text}</p></div>
      <div style="display:flex; flex-direction:column; gap:10px;">
        ${q.options.map((opt, idx) => `<div class="person-vote" onclick="actionDueloAnswer(${i},${idx})">${opt}</div>`).join('')}
      </div>
      ${footer}
    `;
  }

  // guess phase
  if (S.dueloLastResult) {
    const r = S.dueloLastResult;
    return `
      ${logoBlock()}
      <div class="progress">FASE 2: ADIVINHE · ${i + 1} DE ${total}</div>
      <div class="question-card"><p>${q.text}</p></div>
      <div class="result-banner ${r.correct ? 'match' : 'nomatch'}">${r.correct ? 'Você acertou! 🎉' : 'Não foi dessa vez!'}</div>
      <p class="status-banner">A resposta real foi: <b>${q.options[r.actualChoice]}</b></p>
      <button class="btn btn-primary" onclick="actionDueloNext()">PRÓXIMA</button>
      ${footer}
    `;
  }

  return `
    ${logoBlock()}
    <div class="progress">FASE 2: ADIVINHE · ${i + 1} DE ${total}</div>
    <div class="question-card"><p>O que você acha que a outra pessoa respondeu?<br><b>${q.text}</b></p></div>
    <div style="display:flex; flex-direction:column; gap:10px;">
      ${q.options.map((opt, idx) => `<div class="person-vote" onclick="actionDueloGuess(${i},${idx})">${opt}</div>`).join('')}
    </div>
    ${footer}
  `;
}

function screenFinishedDuelo() {
  const f = S.finished;
  return `
    ${logoBlock()}
    <h2 style="text-align:center; color:var(--green-dark); margin-bottom:16px;">RESULTADO DO DUELO</h2>
    ${f.tie ? `<div class="champion-banner">Empate! Vocês se conhecem igualzinho bem. 🤝</div>` : `<div class="champion-banner">${f.winnerName} venceu o duelo! 🏆</div>`}
    ${f.scores.map((s) => `<div class="final-rank"><span class="medal">🎯</span><span class="names">${s.name}</span><span class="score">${s.score}/${f.total}</span></div>`).join('')}
    <div class="top-link"><a href="#" onclick="resetToHome(); return false;">Jogar uma nova partida</a></div>
  `;
}

/* ---------- Resultado final ---------- */

function screenFinishedDupla() {
  const f = S.finished;
  const medals = ['🥇', '🥈', '🥉', '💚'];
  const rows = f.results.map((c, i) => `
    <div class="final-rank"><span class="medal">${medals[i] || '💚'}</span><span class="names">${c.names}</span><span class="score">${c.score} pt${c.score === 1 ? '' : 's'}</span></div>
  `).join('');
  return `
    ${logoBlock()}
    ${f.champion ? `<div class="champion-banner">${f.champion.message}</div>` : ''}
    <h2 style="text-align:center; color:var(--green-dark); margin-bottom:16px;">RESULTADO FINAL</h2>
    ${rows}
    <div class="top-link"><a href="#" onclick="resetToHome(); return false;">Jogar uma nova partida</a></div>
  `;
}

function screenFinishedGrupo() {
  const f = S.finished;
  const cards = f.report.map((p) => `
    <div class="report-card">
      <div class="name">${p.name} <span class="muted" style="font-size:12px; font-weight:700;">(citado(a) em ${p.count} pergunta${p.count === 1 ? '' : 's'})</span></div>
      ${p.titles.length ? `<ul>${p.titles.map((t) => `<li>${t}</li>`).join('')}</ul>` : '<p class="none">Nenhum título nesta partida.</p>'}
    </div>
  `).join('');
  return `
    ${logoBlock()}
    <h2 style="text-align:center; color:var(--green-dark); margin-bottom:6px;">RELATÓRIO · ${f.flavorLabel.toUpperCase()}</h2>
    <p class="muted" style="margin-bottom:16px;">Veja o que o grupo pensa sobre cada um:</p>
    ${cards}
    <div class="top-link"><a href="#" onclick="resetToHome(); return false;">Jogar uma nova partida</a></div>
  `;
}

/* ---------- Início ---------- */

fetch('/api/themes').then((r) => { if (!r.ok) throw new Error('catalog'); return r.json(); }).then((data) => {
  S.themesCatalog = data.themes;
  if (Array.isArray(data.dueloCountOptions) && data.dueloCountOptions.length) {
    S.dueloCountOptions = data.dueloCountOptions;
    S.dueloCount = data.dueloCountOptions[0];
  }
  if (S.screen === 'setupDupla' || S.screen === 'setupDuelo') render();
  Boot.mark('catalog');
}).catch(() => { Boot.fail('Não conseguimos carregar os temas. Verifique sua conexão e tente novamente.'); });

connect();
render();
