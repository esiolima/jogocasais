const GENDER_EMOJI = { M: "🧑‍🦱", F: "👩" };

let ws = null;
let wsReady = false;

let S = {
  screen: 'home',
  error: '',
  connError: '',
  roomCode: null,
  coupleId: null,
  playerIndex: null,
  lobby: null,
  game: null,
  finished: null,
  joinStep: 'code',
  joinCodeInput: '',
  joinLobby: null,
  joinTarget: null,
  formName: '',
  formGender: 'F',
};

function connect() {
  const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
  ws = new WebSocket(proto + location.host);

  ws.addEventListener('open', () => {
    wsReady = true;
    S.connError = '';
    render();
  });

  ws.addEventListener('message', (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }
    handleMessage(msg);
  });

  ws.addEventListener('close', () => {
    wsReady = false;
    S.connError = 'Conexão com o servidor foi encerrada. Recarregue a página para continuar.';
    render();
  });

  ws.addEventListener('error', () => {
    wsReady = false;
  });
}

function sendMsg(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  } else {
    setState({ error: 'Sem conexão com o servidor. Recarregue a página.' });
  }
}

function setState(patch) {
  Object.assign(S, patch);
  render();
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'error':
      setState({ error: msg.message });
      break;
    case 'room_created':
      S.roomCode = msg.code;
      S.coupleId = msg.coupleId;
      S.playerIndex = msg.playerIndex;
      setState({ screen: 'lobby', error: '' });
      break;
    case 'joined':
      S.roomCode = msg.code;
      S.coupleId = msg.coupleId;
      S.playerIndex = msg.playerIndex;
      setState({ screen: 'lobby', error: '' });
      break;
    case 'lookup_result':
      if (!msg.found) { setState({ error: 'Partida não encontrada. Confira o código com quem criou a sala.' }); return; }
      if (msg.started) { setState({ error: 'Esta partida já começou.' }); return; }
      setState({ joinLobby: msg, joinStep: 'details', error: '' });
      break;
    case 'lobby_state':
      S.lobby = msg;
      if (S.screen === 'lobby') render();
      break;
    case 'game_state':
      S.game = msg;
      S.screen = 'game';
      render();
      break;
    case 'game_finished':
      S.finished = msg;
      S.screen = 'finished';
      render();
      break;
  }
}

/* ---------- Ações do jogador ---------- */

function actionCreateRoom() {
  if (!S.formName.trim()) { setState({ error: 'Digite seu nome.' }); return; }
  sendMsg({ type: 'create_room', name: S.formName.trim(), gender: S.formGender });
}

function actionLookupRoom() {
  const code = S.joinCodeInput.trim().toUpperCase();
  if (code.length < 4) { setState({ error: 'Digite o código da partida.' }); return; }
  S.roomCode = code;
  sendMsg({ type: 'lookup_room', code });
}

function actionJoinRoom() {
  if (!S.formName.trim()) { setState({ error: 'Digite seu nome.' }); return; }
  if (!S.joinTarget) { setState({ error: 'Escolha uma opção.' }); return; }
  sendMsg({ type: 'join_room', code: S.roomCode, name: S.formName.trim(), gender: S.formGender, target: S.joinTarget });
}

function actionStartGame() {
  sendMsg({ type: 'start_game' });
}

function actionAnswer(choice) {
  sendMsg({ type: 'answer', choice });
}

function actionReady() {
  sendMsg({ type: 'ready' });
}

function copyCode() {
  if (navigator.clipboard) navigator.clipboard.writeText(S.roomCode);
}

/* ---------- Renderização ---------- */

function render() {
  document.getElementById('app').innerHTML = renderScreen();
}

function logoBlock() {
  return `
    <div class="logo"><h1>NA MESMA</h1><div class="underline"></div></div>
    <div class="tagline">Será que vocês pensam na mesma pessoa?</div>
  `;
}

function errBlock() {
  return S.error ? `<div class="error-box">${S.error}</div>` : '';
}

function connErrBlock() {
  return S.connError ? `<div class="error-box">${S.connError}</div>` : '';
}

function renderScreen() {
  if (S.connError) return `${logoBlock()}${connErrBlock()}`;
  switch (S.screen) {
    case 'home': return screenHome();
    case 'create': return screenCreate();
    case 'join': return screenJoin();
    case 'lobby': return screenLobby();
    case 'game': return screenGame();
    case 'finished': return screenFinished();
    default: return screenHome();
  }
}

function screenHome() {
  return `
    ${logoBlock()}
    ${errBlock()}
    <button class="btn btn-primary" onclick="setState({screen:'create', error:'', formName:'', formGender:'F'})">CRIAR PARTIDA</button>
    <button class="btn btn-secondary" onclick="setState({screen:'join', joinStep:'code', joinCodeInput:'', error:'', formName:'', formGender:'F', joinTarget:null})">ENTRAR EM UMA PARTIDA</button>
    <p class="muted">Até 4 casais podem jogar na mesma sala.</p>
  `;
}

function genderPicker() {
  return `
    <label class="field-label">Seu gênero</label>
    <div class="gender-row">
      <div class="gender-opt ${S.formGender === 'F' ? 'selected' : ''}" onclick="setState({formGender:'F'})">
        <span class="emoji">👩</span>Feminino
      </div>
      <div class="gender-opt ${S.formGender === 'M' ? 'selected' : ''}" onclick="setState({formGender:'M'})">
        <span class="emoji">🧑‍🦱</span>Masculino
      </div>
    </div>
  `;
}

function screenCreate() {
  return `
    ${logoBlock()}
    <div class="card">
      <label class="field-label">Seu nome</label>
      <input type="text" value="${S.formName}" oninput="S.formName=this.value" placeholder="Ex: Plínio">
      ${genderPicker()}
      ${errBlock()}
      <button class="btn btn-primary" onclick="actionCreateRoom()">CRIAR</button>
      <button class="btn btn-ghost" onclick="setState({screen:'home', error:''})">Voltar</button>
    </div>
  `;
}

function screenJoin() {
  if (S.joinStep === 'code') {
    return `
      ${logoBlock()}
      <div class="card">
        <label class="field-label">Código da partida</label>
        <input type="text" style="text-transform:uppercase; text-align:center; letter-spacing:4px; font-family:'Baloo 2'; font-size:22px;" value="${S.joinCodeInput}" oninput="S.joinCodeInput=this.value.toUpperCase()" placeholder="K7P2XM" maxlength="6">
        ${errBlock()}
        <button class="btn btn-primary" onclick="actionLookupRoom()">CONTINUAR</button>
        <button class="btn btn-ghost" onclick="setState({screen:'home', error:''})">Voltar</button>
      </div>
    `;
  }

  const lobby = S.joinLobby;
  const openCouples = lobby.couples.filter((c) => !c.complete);
  const canNew = lobby.couples.length < lobby.maxCouples;

  let options = openCouples.map((c) => `
    <div class="gender-opt ${S.joinTarget === c.id ? 'selected' : ''}" style="text-align:left; display:flex; align-items:center; gap:10px;" onclick="setState({joinTarget:'${c.id}'})">
      <span class="emoji" style="font-size:20px;">${GENDER_EMOJI[c.players[0].gender]}</span>
      Entrar como parceiro(a) de <b>&nbsp;${c.players[0].name}</b>
    </div>
  `).join('');

  if (canNew) {
    options += `
      <div class="gender-opt ${S.joinTarget === '__new__' ? 'selected' : ''}" style="text-align:left;" onclick="setState({joinTarget:'__new__'})">
        ➕ Criar novo casal
      </div>
    `;
  }
  if (!options) options = `<p class="muted">Esta partida já está cheia.</p>`;

  return `
    ${logoBlock()}
    <div class="card">
      <p class="muted" style="margin-bottom:14px;">Partida <b>${lobby.code}</b></p>
      <label class="field-label">Seu nome</label>
      <input type="text" value="${S.formName}" oninput="S.formName=this.value" placeholder="Seu nome">
      ${genderPicker()}
      <label class="field-label">Escolha uma opção</label>
      <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px;">${options}</div>
      ${errBlock()}
      <button class="btn btn-primary" onclick="actionJoinRoom()">ENTRAR</button>
      <button class="btn btn-ghost" onclick="setState({screen:'home', error:''})">Voltar</button>
    </div>
  `;
}

function screenLobby() {
  const lobby = S.lobby;
  if (!lobby) return `${logoBlock()}<p class="muted">Carregando sala...</p>`;

  const iAmHost = lobby.hostCoupleId === S.coupleId && S.playerIndex === 0;
  const completeCount = lobby.couples.filter((c) => c.complete).length;

  const rows = lobby.couples.map((c) => {
    const names = c.players.map((p) => `${GENDER_EMOJI[p.gender]} ${p.name}`).join(' &nbsp;+&nbsp; ');
    return `
      <div class="couple-row ${c.complete ? 'complete' : ''}">
        <span>${names}${c.complete ? '' : ' <span class="muted">(aguardando parceiro)</span>'}</span>
        <span class="pill ${c.complete ? 'ok' : 'wait'}">${c.complete ? 'Completo' : 'Incompleto'}</span>
      </div>
    `;
  }).join('');

  return `
    ${logoBlock()}
    <div class="card">
      <p class="muted">Compartilhe este código com os casais:</p>
      <div class="code-box">${lobby.code}</div>
      <button class="btn btn-secondary" onclick="copyCode()">COPIAR CÓDIGO</button>
      <h3 style="margin:18px 0 10px; font-size:16px; color:var(--ink-soft);">Casais na sala (${lobby.couples.length}/${lobby.maxCouples})</h3>
      ${rows}
      ${errBlock()}
      ${iAmHost
        ? `<button class="btn btn-primary" ${completeCount === 0 ? 'disabled' : ''} onclick="actionStartGame()">INICIAR JOGO</button>`
        : `<p class="muted">Aguardando o organizador iniciar a partida...</p>`}
    </div>
  `;
}

function scoreBoardHTML(game) {
  const lines = game.scoreboard.map((c) => `
    <div class="score-line ${c.mine ? 'me' : ''}"><span>${c.names}</span><span>${c.score}</span></div>
  `).join('');
  return `<div class="score-board"><h3>PLACAR</h3>${lines}</div>`;
}

function screenGame() {
  const g = S.game;
  if (!g) return `${logoBlock()}<p class="muted">Carregando pergunta...</p>`;

  if (g.incomplete) {
    return `${logoBlock()}<div class="card"><p class="muted">Sua dupla está incompleta. Peça para seu parceiro entrar na sala antes do próximo jogo.</p></div>`;
  }

  let body = '';
  if (!g.revealed) {
    if (g.myAnswer === null) {
      body = `
        <div class="choice-row">
          <div class="choice-card eu" onclick="actionAnswer('EU')">
            <span class="avatar">${GENDER_EMOJI[g.myGender]}</span>EU
          </div>
          <div class="choice-card voce" onclick="actionAnswer('VOCE')">
            <span class="avatar">${GENDER_EMOJI[g.partnerGender]}</span>VOCÊ
          </div>
        </div>
        <p class="status-banner">Quem você acha?</p>
      `;
    } else {
      body = `
        <div class="choice-row">
          <div class="choice-card eu locked"><span class="avatar">${GENDER_EMOJI[g.myGender]}</span>EU</div>
          <div class="choice-card voce locked"><span class="avatar">${GENDER_EMOJI[g.partnerGender]}</span>VOCÊ</div>
        </div>
        <p class="status-banner">Resposta registrada.<br>Aguardando ${g.partnerName}...</p>
      `;
    }
  } else {
    body = `
      <div class="reveal-row">
        <div class="reveal-card"><div class="name">Você</div><div class="ans">${g.myAnswer === 'EU' ? 'EU' : 'VOCÊ'}</div></div>
        <div class="reveal-card"><div class="name">${g.partnerName}</div><div class="ans">${g.partnerAnswer === 'EU' ? 'EU' : 'VOCÊ'}</div></div>
      </div>
      <div class="result-banner ${g.match ? 'match' : 'nomatch'}">${g.match ? 'NA MESMA! 🎉' : 'NÃO FOI DESSA VEZ'}</div>
      ${g.myReady
        ? `<p class="status-banner">Aguardando ${g.partnerName} confirmar...</p>`
        : `<button class="btn btn-primary" onclick="actionReady()">PRÓXIMA</button>`}
    `;
  }

  return `
    ${logoBlock()}
    <div class="progress">PERGUNTA ${g.questionIndex + 1} DE ${g.totalQuestions}</div>
    <div class="question-card"><div class="heart">❤️</div><p>${g.questionText}</p></div>
    ${body}
    ${scoreBoardHTML(g)}
  `;
}

function faixaMessage(score, total) {
  const pct = score / total;
  if (pct <= 0.20) return 'Quase nunca na mesma 😅';
  if (pct <= 0.40) return 'Vocês gostam de surpreender um ao outro.';
  if (pct <= 0.60) return 'Tem sintonia aí!';
  if (pct <= 0.80) return 'Vocês estão bem na mesma.';
  return 'Vocês estão MUITO na mesma! 🎉';
}

function screenFinished() {
  const f = S.finished;
  if (!f) return `${logoBlock()}<p class="muted">Calculando resultado...</p>`;
  const medals = ['🥇', '🥈', '🥉', '💗'];
  const rows = f.results.map((c, i) => `
    <div class="final-rank">
      <span class="medal">${medals[i] || '💗'}</span>
      <span class="names">${c.names}<br><span class="muted">${faixaMessage(c.score, f.total)}</span></span>
      <span class="score">${c.score}/${f.total}</span>
    </div>
  `).join('');
  return `
    ${logoBlock()}
    <h2 style="text-align:center; color:var(--pink-dark); margin-bottom:16px;">RESULTADO FINAL</h2>
    ${rows}
    <div class="top-link"><a href="/">Jogar uma nova partida</a></div>
  `;
}

connect();
render();
