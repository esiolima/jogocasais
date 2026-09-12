const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const THEMES = JSON.parse(fs.readFileSync(path.join(__dirname, 'themes.json'), 'utf8'));
const FAMILIA = JSON.parse(fs.readFileSync(path.join(__dirname, 'familia.json'), 'utf8'));

const MAX_COUPLES = 4;
const MAX_GROUP_PLAYERS = 6;
const MIN_GROUP_PLAYERS = 3;
const QUESTION_COUNT_OPTIONS = [20, 50, 75, 100];

const RELATIONSHIP_LABELS = {
  casal: { label: 'Casal', article: 'o', suffix: 'o' },
  amigos: { label: 'Dupla de amigos', article: 'a', suffix: 'a' },
  irmaos: { label: 'Dupla de irmãos', article: 'a', suffix: 'a' },
  pais_filhos: { label: 'Dupla', article: 'a', suffix: 'a' },
  outro: { label: 'Dupla', article: 'a', suffix: 'a' },
};

const rooms = new Map();

function uid() { return Math.random().toString(36).slice(2, 10); }

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function themeById(id) { return THEMES.find((t) => t.id === id); }

/**
 * Monta o conjunto de perguntas de uma partida de Modo Dupla.
 * Cada item: { text, themeId, themeName, themeIcon, value }
 */
function buildDuplaQuestionSet(opts) {
  const { themeId, rankingMode, tensionMode, questionCount, customQuestions } = opts;

  if (customQuestions && customQuestions.length > 0) {
    const list = shuffle(customQuestions).slice(0, 200);
    return list.map((text) => ({ text, themeId: 'personalizado', themeName: 'Personalizado', themeIcon: '✍️', value: 1 }));
  }

  let pool = [];

  if (themeId === 'aleatorio') {
    if (tensionMode) {
      THEMES.forEach((t) => {
        t.tension.forEach((q) => pool.push({ text: q, themeId: t.id, themeName: t.name, themeIcon: t.icon, value: rankingMode ? t.rankingPoints : 1 }));
      });
    } else {
      THEMES.forEach((t) => {
        t.questions.forEach((q) => pool.push({ text: q, themeId: t.id, themeName: t.name, themeIcon: t.icon, value: rankingMode ? t.rankingPoints : 1 }));
        t.tension.forEach((q) => pool.push({ text: q, themeId: t.id, themeName: t.name, themeIcon: t.icon, value: (rankingMode ? t.rankingPoints : 1) + 1 }));
      });
    }
  } else {
    const theme = themeById(themeId) || THEMES[0];
    pool = theme.questions.map((q) => ({ text: q, themeId: theme.id, themeName: theme.name, themeIcon: theme.icon, value: 1 }));
  }

  const n = Math.min(questionCount, pool.length);
  return shuffle(pool).slice(0, n);
}

function buildGrupoQuestionSet(opts) {
  const { tensionMode, questionCount, customQuestions } = opts;
  if (customQuestions && customQuestions.length > 0) {
    const list = shuffle(customQuestions).slice(0, 200);
    return list.map((text) => ({ text, themeName: 'Personalizado', themeIcon: '✍️' }));
  }
  const source = tensionMode ? FAMILIA.tension : FAMILIA.questions.concat(FAMILIA.tension);
  const n = Math.min(questionCount, source.length);
  return shuffle(source).slice(0, n).map((text) => ({ text, themeName: 'Família & Amigos', themeIcon: '👨‍👩‍👧‍👦' }));
}

function send(ws, obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

/* ================== MODO DUPLA ================== */

function lobbyPayloadDupla(room) {
  return {
    type: 'lobby_state', mode: 'dupla', code: room.code, maxCouples: room.maxCouples,
    hostCoupleId: room.hostCoupleId, relationshipType: room.relationshipType,
    questionCount: room.questions.length,
    couples: room.couples.map((c) => ({
      id: c.id,
      players: c.players.map((p) => ({ name: p.name, gender: p.gender })),
      complete: c.players.length === 2,
    })),
  };
}

function broadcastLobbyDupla(room) {
  const payload = lobbyPayloadDupla(room);
  room.couples.forEach((c) => c.players.forEach((p) => send(p.ws, payload)));
}

function scoreboardForDupla(room, forCoupleId) {
  return room.couples
    .filter((c) => c.players.length === 2)
    .map((c) => ({ coupleId: c.id, names: c.players.map((p) => p.name).join(' & '), score: c.score, mine: c.id === forCoupleId }))
    .sort((a, b) => b.score - a.score);
}

function gamePayloadForDupla(room, couple, playerIndex) {
  if (!couple || couple.players.length < 2) return { type: 'game_state', mode: 'dupla', incomplete: true };
  const partnerIndex = 1 - playerIndex;
  const me = couple.players[playerIndex];
  const partner = couple.players[partnerIndex];
  const q = room.questions[room.currentIndex];
  const myAnswer = couple.answers[playerIndex];
  const partnerAnswer = couple.answers[partnerIndex];
  const revealed = myAnswer !== null && partnerAnswer !== null;

  return {
    type: 'game_state', mode: 'dupla', incomplete: false,
    questionIndex: room.currentIndex, totalQuestions: room.questions.length,
    questionText: q.text, themeName: q.themeName, themeIcon: q.themeIcon, questionValue: q.value,
    myGender: me.gender, partnerGender: partner.gender, partnerName: partner.name,
    myAnswer, partnerAnswer: revealed ? partnerAnswer : null, revealed,
    match: revealed ? myAnswer !== partnerAnswer : null,
    myReady: couple.ready[playerIndex], partnerReady: couple.ready[partnerIndex],
    score: couple.score, scoreboard: scoreboardForDupla(room, couple.id),
  };
}

function broadcastGameDupla(room) {
  room.couples.forEach((c) => c.players.forEach((p, idx) => send(p.ws, gamePayloadForDupla(room, c, idx))));
}

function championMessage(room) {
  const complete = room.couples.filter((c) => c.players.length === 2);
  if (complete.length === 0) return null;
  const maxScore = Math.max(...complete.map((c) => c.score));
  const tied = complete.filter((c) => c.score === maxScore);
  let winner = tied[0];
  if (tied.length > 1) {
    winner = tied.reduce((best, c) => ((c.finalAnswerAt || Infinity) < (best.finalAnswerAt || Infinity) ? c : best), tied[0]);
  }
  const names = winner.players.map((p) => p.name).join(' & ');
  const rel = RELATIONSHIP_LABELS[room.relationshipType] || RELATIONSHIP_LABELS.outro;
  return { coupleId: winner.id, names, message: `${rel.label} ${names} foi ${rel.article} grande campe${rel.suffix}! 🏆` };
}

function finishedPayloadDupla(room) {
  const ranked = room.couples
    .filter((c) => c.players.length === 2)
    .map((c) => ({ names: c.players.map((p) => p.name).join(' & '), score: c.score, finalAnswerAt: c.finalAnswerAt || Infinity }))
    .sort((a, b) => b.score - a.score || a.finalAnswerAt - b.finalAnswerAt);
  return {
    type: 'game_finished', mode: 'dupla',
    results: ranked.map((r) => ({ names: r.names, score: r.score })),
    total: room.questions.length, champion: championMessage(room),
  };
}

function broadcastFinishedDupla(room) {
  const payload = finishedPayloadDupla(room);
  room.couples.forEach((c) => c.players.forEach((p) => send(p.ws, payload)));
}

function maybeAdvanceDupla(room) {
  const playable = room.couples.filter((c) => c.players.length === 2);
  if (playable.length === 0) return;
  if (!playable.every((c) => c.ready[0] && c.ready[1])) return;

  room.currentIndex += 1;
  if (room.currentIndex >= room.questions.length) {
    room.status = 'finished';
    broadcastFinishedDupla(room);
  } else {
    room.couples.forEach((c) => { c.answers = [null, null]; c.ready = [false, false]; c.roundScored = false; });
    broadcastGameDupla(room);
  }
}

/* ================== MODO GRUPO (Família / Galera) ================== */

function lobbyPayloadGrupo(room) {
  return {
    type: 'lobby_state', mode: 'grupo', code: room.code, flavor: room.flavor,
    maxPlayers: room.maxPlayers, hostId: room.hostId, questionCount: room.questions.length,
    players: room.players.map((p) => ({ id: p.id, name: p.name })),
  };
}

function broadcastLobbyGrupo(room) {
  const payload = lobbyPayloadGrupo(room);
  room.players.forEach((p) => send(p.ws, payload));
}

function gamePayloadForGrupo(room, myId) {
  const q = room.questions[room.currentIndex];
  const round = room.rounds[room.currentIndex];
  const allVoted = room.players.every((p) => round.votes[p.id] !== undefined);
  const myVote = round.votes[myId];
  const myReady = round.ready[myId] || false;

  let tally = null;
  if (allVoted) {
    const counts = {};
    room.players.forEach((p) => { counts[p.id] = 0; });
    Object.values(round.votes).forEach((targetId) => { counts[targetId] = (counts[targetId] || 0) + 1; });
    tally = room.players.map((p) => ({ playerId: p.id, name: p.name, votes: counts[p.id] || 0 })).sort((a, b) => b.votes - a.votes);
  }

  return {
    type: 'game_state', mode: 'grupo', flavor: room.flavor,
    questionIndex: room.currentIndex, totalQuestions: room.questions.length,
    questionText: q.text, themeName: q.themeName, themeIcon: q.themeIcon,
    players: room.players.map((p) => ({ id: p.id, name: p.name })),
    myVote: myVote || null, allVoted, tally,
    winnerId: round.winnerId, tie: allVoted && round.winnerId === null,
    myReady, readyCount: Object.values(round.ready).filter(Boolean).length, totalPlayers: room.players.length,
    votedCount: Object.keys(round.votes).length,
  };
}

function broadcastGameGrupo(room) {
  room.players.forEach((p) => send(p.ws, gamePayloadForGrupo(room, p.id)));
}

function finishedPayloadGrupo(room) {
  const titlesByPlayer = {};
  room.players.forEach((p) => { titlesByPlayer[p.id] = []; });
  room.rounds.forEach((round, i) => {
    if (round.winnerId) titlesByPlayer[round.winnerId].push(room.questions[i].text);
  });
  const flavorLabel = room.flavor === 'familia' ? 'Família' : 'Galera';
  return {
    type: 'game_finished', mode: 'grupo', flavorLabel,
    report: room.players.map((p) => ({ name: p.name, titles: titlesByPlayer[p.id] })),
  };
}

function broadcastFinishedGrupo(room) {
  const payload = finishedPayloadGrupo(room);
  room.players.forEach((p) => send(p.ws, payload));
}

function maybeAdvanceGrupo(room) {
  const round = room.rounds[room.currentIndex];
  if (!room.players.every((p) => round.ready[p.id])) return;

  room.currentIndex += 1;
  if (room.currentIndex >= room.questions.length) {
    room.status = 'finished';
    broadcastFinishedGrupo(room);
  } else {
    room.rounds[room.currentIndex] = { votes: {}, ready: {}, winnerId: null };
    broadcastGameGrupo(room);
  }
}

/* ================== CONEXÃO WEBSOCKET ================== */

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    if (msg.type === 'create_room') {
      const name = (msg.name || '').trim().slice(0, 30);
      if (!name) return send(ws, { type: 'error', message: 'Digite seu nome.' });
      const mode = msg.mode === 'grupo' ? 'grupo' : 'dupla';
      const questionCount = QUESTION_COUNT_OPTIONS.includes(msg.questionCount) ? msg.questionCount : 20;
      const customQuestions = Array.isArray(msg.customQuestions)
        ? msg.customQuestions.map((q) => String(q).trim()).filter(Boolean).slice(0, 200) : null;
      const code = genCode();

      if (mode === 'dupla') {
        const gender = msg.gender === 'M' ? 'M' : 'F';
        const relationshipType = ['casal', 'amigos', 'irmaos', 'pais_filhos', 'outro'].includes(msg.relationshipType) ? msg.relationshipType : 'casal';
        const themeId = (customQuestions && customQuestions.length > 0) ? 'personalizado'
          : (THEMES.some((t) => t.id === msg.themeId) ? msg.themeId : 'aleatorio');
        const rankingMode = themeId === 'aleatorio' && !!msg.rankingMode;
        const tensionMode = themeId === 'aleatorio' && !!msg.tensionMode;
        const questions = buildDuplaQuestionSet({ themeId, rankingMode, tensionMode, questionCount, customQuestions });

        const playerId = uid();
        const couple = { id: uid(), players: [{ id: playerId, name, gender, ws }], answers: [null, null], ready: [false, false], score: 0, roundScored: false, finalAnswerAt: null };
        const room = {
          mode, code, maxCouples: MAX_COUPLES, relationshipType, themeId, rankingMode, tensionMode,
          couples: [couple], questions, currentIndex: 0, status: 'lobby', hostCoupleId: couple.id,
        };
        rooms.set(code, room);
        ws.roomCode = code; ws.coupleId = couple.id; ws.playerIndex = 0;
        send(ws, { type: 'room_created', mode, code, coupleId: couple.id, playerIndex: 0 });
        broadcastLobbyDupla(room);
      } else {
        const flavor = msg.flavor === 'familia' ? 'familia' : 'galera';
        const tensionMode = !!msg.tensionMode;
        const questions = buildGrupoQuestionSet({ tensionMode, questionCount, customQuestions });
        const playerId = uid();
        const room = {
          mode, code, flavor, tensionMode, maxPlayers: MAX_GROUP_PLAYERS,
          players: [{ id: playerId, name, ws }],
          questions, currentIndex: 0, status: 'lobby', hostId: playerId,
          rounds: [{ votes: {}, ready: {}, winnerId: null }],
        };
        rooms.set(code, room);
        ws.roomCode = code; ws.playerId = playerId;
        send(ws, { type: 'room_created', mode, code, playerId });
        broadcastLobbyGrupo(room);
      }
      return;
    }

    if (msg.type === 'lookup_room') {
      const room = rooms.get((msg.code || '').toUpperCase());
      if (!room) return send(ws, { type: 'lookup_result', found: false });
      if (room.status !== 'lobby') return send(ws, { type: 'lookup_result', found: true, started: true });
      const payload = room.mode === 'dupla' ? lobbyPayloadDupla(room) : lobbyPayloadGrupo(room);
      send(ws, Object.assign(payload, { type: 'lookup_result', found: true, started: false }));
      return;
    }

    if (msg.type === 'join_room') {
      const code = (msg.code || '').toUpperCase();
      const room = rooms.get(code);
      if (!room) return send(ws, { type: 'error', message: 'Partida não encontrada.' });
      if (room.status !== 'lobby') return send(ws, { type: 'error', message: 'Esta partida já começou.' });
      const name = (msg.name || '').trim().slice(0, 30);
      if (!name) return send(ws, { type: 'error', message: 'Digite seu nome.' });

      if (room.mode === 'dupla') {
        const gender = msg.gender === 'M' ? 'M' : 'F';
        const playerId = uid();
        if (msg.target === 'new') {
          if (room.couples.length >= room.maxCouples) return send(ws, { type: 'error', message: 'Esta partida já está cheia (4 duplas).' });
          const couple = { id: uid(), players: [{ id: playerId, name, gender, ws }], answers: [null, null], ready: [false, false], score: 0, roundScored: false, finalAnswerAt: null };
          room.couples.push(couple);
          ws.roomCode = code; ws.coupleId = couple.id; ws.playerIndex = 0;
          send(ws, { type: 'joined', mode: 'dupla', code, coupleId: couple.id, playerIndex: 0 });
        } else {
          const couple = room.couples.find((c) => c.id === msg.target);
          if (!couple || couple.players.length >= 2) return send(ws, { type: 'error', message: 'Essa vaga já foi preenchida.' });
          couple.players.push({ id: playerId, name, gender, ws });
          ws.roomCode = code; ws.coupleId = couple.id; ws.playerIndex = 1;
          send(ws, { type: 'joined', mode: 'dupla', code, coupleId: couple.id, playerIndex: 1 });
        }
        broadcastLobbyDupla(room);
      } else {
        if (room.players.length >= room.maxPlayers) return send(ws, { type: 'error', message: `Esta partida já está cheia (${room.maxPlayers} pessoas).` });
        const playerId = uid();
        room.players.push({ id: playerId, name, ws });
        ws.roomCode = code; ws.playerId = playerId;
        send(ws, { type: 'joined', mode: 'grupo', code, playerId });
        broadcastLobbyGrupo(room);
      }
      return;
    }

    if (msg.type === 'start_game') {
      const room = rooms.get(ws.roomCode);
      if (!room) return;
      if (room.mode === 'dupla') {
        if (room.hostCoupleId !== ws.coupleId || ws.playerIndex !== 0) return send(ws, { type: 'error', message: 'Só quem criou a sala pode iniciar.' });
        if (room.couples.filter((c) => c.players.length === 2).length === 0) return send(ws, { type: 'error', message: 'Pelo menos uma dupla precisa estar completa.' });
        room.status = 'playing'; room.currentIndex = 0;
        broadcastGameDupla(room);
      } else {
        if (room.hostId !== ws.playerId) return send(ws, { type: 'error', message: 'Só quem criou a sala pode iniciar.' });
        if (room.players.length < MIN_GROUP_PLAYERS) return send(ws, { type: 'error', message: `São necessárias pelo menos ${MIN_GROUP_PLAYERS} pessoas para começar.` });
        room.status = 'playing'; room.currentIndex = 0;
        broadcastGameGrupo(room);
      }
      return;
    }

    if (msg.type === 'answer') {
      const room = rooms.get(ws.roomCode);
      if (!room || room.mode !== 'dupla' || room.status !== 'playing') return;
      const couple = room.couples.find((c) => c.id === ws.coupleId);
      if (!couple || couple.players.length < 2) return;
      if (couple.answers[ws.playerIndex] !== null) return;
      if (msg.choice !== 'EU' && msg.choice !== 'VOCE') return;

      couple.answers[ws.playerIndex] = msg.choice;
      if (couple.answers[0] !== null && couple.answers[1] !== null && !couple.roundScored) {
        if (couple.answers[0] !== couple.answers[1]) couple.score += room.questions[room.currentIndex].value;
        couple.roundScored = true;
        if (room.currentIndex === room.questions.length - 1) couple.finalAnswerAt = Date.now();
      }
      broadcastGameDupla(room);
      return;
    }

    if (msg.type === 'vote') {
      const room = rooms.get(ws.roomCode);
      if (!room || room.mode !== 'grupo' || room.status !== 'playing') return;
      const round = room.rounds[room.currentIndex];
      if (round.votes[ws.playerId] !== undefined) return;
      if (!room.players.some((p) => p.id === msg.targetId)) return;
      round.votes[ws.playerId] = msg.targetId;

      const allVoted = room.players.every((p) => round.votes[p.id] !== undefined);
      if (allVoted && round.winnerId === null) {
        const counts = {};
        Object.values(round.votes).forEach((t) => { counts[t] = (counts[t] || 0) + 1; });
        const max = Math.max(...Object.values(counts));
        const topIds = Object.keys(counts).filter((id) => counts[id] === max);
        round.winnerId = topIds.length === 1 ? topIds[0] : null;
      }
      broadcastGameGrupo(room);
      return;
    }

    if (msg.type === 'ready') {
      const room = rooms.get(ws.roomCode);
      if (!room || room.status !== 'playing') return;
      if (room.mode === 'dupla') {
        const couple = room.couples.find((c) => c.id === ws.coupleId);
        if (!couple) return;
        couple.ready[ws.playerIndex] = true;
        broadcastGameDupla(room);
        maybeAdvanceDupla(room);
      } else {
        const round = room.rounds[room.currentIndex];
        round.ready[ws.playerId] = true;
        broadcastGameGrupo(room);
        maybeAdvanceGrupo(room);
      }
      return;
    }
  });

  ws.on('close', () => {
    const room = rooms.get(ws.roomCode);
    if (!room) return;
    if (room.mode === 'dupla') {
      const couple = room.couples.find((c) => c.id === ws.coupleId);
      if (couple) { const p = couple.players[ws.playerIndex]; if (p) p.disconnected = true; }
      if (room.status === 'lobby') broadcastLobbyDupla(room);
    } else {
      const p = room.players.find((pl) => pl.id === ws.playerId);
      if (p) p.disconnected = true;
      if (room.status === 'lobby') broadcastLobbyGrupo(room);
    }
  });
});

// Ping/keepalive: evita que proxies (Railway etc.) derrubem conexões ociosas.
const KEEPALIVE_MS = 25000;
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(); } catch (e) { /* ignore */ }
  });
}, KEEPALIVE_MS);

// Endpoint auxiliar para o front-end montar as telas de escolha de tema.
app.get('/api/themes', (req, res) => {
  res.json({
    themes: THEMES.map((t) => ({ id: t.id, name: t.name, icon: t.icon, count: t.questions.length, rankingPoints: t.rankingPoints })),
    questionCountOptions: QUESTION_COUNT_OPTIONS,
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('ConectAí rodando em http://localhost:' + PORT);
});
