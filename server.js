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
const QUIZ = JSON.parse(fs.readFileSync(path.join(__dirname, 'quiz.json'), 'utf8'));

const MAX_COUPLES = 4;
const MAX_GROUP_PLAYERS = 6;
const MIN_GROUP_PLAYERS = 3;
const QUESTION_COUNT_OPTIONS = [20, 50, 75, 100];
const DUELO_COUNT_OPTIONS = [10, 20, QUIZ.length];

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
    pool = theme.questions.map((q) => ({ text: q, themeId: theme.id, themeName: theme.name, themeIcon: theme.icon, value: 1 }))
      .concat(theme.tension.map((q) => ({ text: q, themeId: theme.id, themeName: theme.name, themeIcon: theme.icon, value: 1 })));
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
      players: c.players.map((p) => ({ name: p.name, gender: p.gender, disconnected: !!p.disconnected })),
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
  const skipped = revealed && (myAnswer === 'PULAR' || partnerAnswer === 'PULAR');

  return {
    type: 'game_state', mode: 'dupla', incomplete: false,
    questionIndex: room.currentIndex, totalQuestions: room.questions.length,
    questionText: q.text, themeName: q.themeName, themeIcon: q.themeIcon, questionValue: q.value,
    myGender: me.gender, partnerGender: partner.gender, partnerName: partner.name,
    myAnswer, partnerAnswer: revealed ? partnerAnswer : null, revealed, skipped,
    match: revealed && !skipped ? myAnswer !== partnerAnswer : null,
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
    players: room.players.map((p) => ({ id: p.id, name: p.name, disconnected: !!p.disconnected })),
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
  if (allVoted && !round.skipped) {
    const counts = {};
    room.players.forEach((p) => { counts[p.id] = 0; });
    Object.values(round.votes).forEach((targetId) => { if (targetId !== 'PULAR') counts[targetId] = (counts[targetId] || 0) + 1; });
    tally = room.players.map((p) => ({ playerId: p.id, name: p.name, votes: counts[p.id] || 0 })).sort((a, b) => b.votes - a.votes);
  }

  return {
    type: 'game_state', mode: 'grupo', flavor: room.flavor,
    questionIndex: room.currentIndex, totalQuestions: room.questions.length,
    questionText: q.text, themeName: q.themeName, themeIcon: q.themeIcon,
    players: room.players.map((p) => ({ id: p.id, name: p.name })),
    myVote: myVote || null, allVoted, tally, skipped: round.skipped,
    winnerId: round.winnerId, tie: allVoted && !round.skipped && round.winnerId === null,
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
    report: room.players.map((p) => ({ name: p.name, count: titlesByPlayer[p.id].length, titles: titlesByPlayer[p.id] })),
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
    room.rounds[room.currentIndex] = { votes: {}, ready: {}, winnerId: null, skipped: false };
    broadcastGameGrupo(room);
  }
}

/* ================== CHAT (todos os modos) ================== */

function allSocketsInRoom(room) {
  if (room.mode === 'dupla') return room.couples.flatMap((c) => c.players);
  if (room.mode === 'grupo') return room.players;
  return room.players; // duelo
}

function broadcastChat(room, name, text) {
  const payload = { type: 'chat_message', name, text, ts: Date.now() };
  allSocketsInRoom(room).forEach((p) => send(p.ws, payload));
}

/* ================== MODO DUELO (1x1) ================== */

function pickDueloQuestions(count) {
  const n = Math.min(count, QUIZ.length);
  return shuffle(QUIZ.map((q, i) => i)).slice(0, n).map((i) => ({ text: QUIZ[i].text, options: QUIZ[i].options }));
}

function lobbyPayloadDuelo(room) {
  return {
    type: 'lobby_state', mode: 'duelo', code: room.code, hostId: room.hostId,
    questionCount: room.questions.length,
    players: room.players.map((p) => ({ id: p.id, name: p.name, disconnected: !!p.disconnected })),
  };
}

function broadcastLobbyDuelo(room) {
  const payload = lobbyPayloadDuelo(room);
  room.players.forEach((p) => send(p.ws, payload));
}

function startDueloSetup(room) {
  room.phase = 'setup';
  const payload = { type: 'duelo_setup', questions: room.questions, totalQuestions: room.questions.length };
  room.players.forEach((p) => send(p.ws, payload));
}

function startDueloGuess(room) {
  room.phase = 'guess';
  const payload = { type: 'duelo_guess_start', questions: room.questions.map((q) => ({ text: q.text, options: q.options })), totalQuestions: room.questions.length };
  room.players.forEach((p) => send(p.ws, payload));
}

function finishedPayloadDuelo(room) {
  const s0 = room.scores[0];
  const s1 = room.scores[1];
  const scores = room.players.map((p, i) => ({ name: p.name, score: room.scores[i] }));
  const tie = s0 === s1;
  const winnerName = tie ? null : (s0 > s1 ? room.players[0].name : room.players[1].name);
  return { type: 'game_finished', mode: 'duelo', scores, total: room.questions.length, tie, winnerName };
}

function finishDuelo(room) {
  room.status = 'finished';
  const payload = finishedPayloadDuelo(room);
  room.players.forEach((p) => send(p.ws, payload));
}



wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    if (msg.type === 'create_room') {
      const name = (msg.name || '').trim().slice(0, 30);
      if (!name) return send(ws, { type: 'error', message: 'Digite seu nome.' });
      const mode = (msg.mode === 'grupo' || msg.mode === 'duelo') ? msg.mode : 'dupla';
      const questionCount = Number.isInteger(msg.questionCount) && msg.questionCount > 0 && msg.questionCount <= 400 ? msg.questionCount : 20;
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
        const sessionToken = uid() + uid();
        const couple = { id: uid(), players: [{ id: playerId, name, gender, ws, sessionToken }], answers: [null, null], ready: [false, false], score: 0, roundScored: false, finalAnswerAt: null };
        const room = {
          mode, code, maxCouples: MAX_COUPLES, relationshipType, themeId, rankingMode, tensionMode,
          couples: [couple], questions, currentIndex: 0, status: 'lobby', hostCoupleId: couple.id,
        };
        rooms.set(code, room);
        ws.roomCode = code; ws.coupleId = couple.id; ws.playerIndex = 0;
        send(ws, { type: 'room_created', mode, code, coupleId: couple.id, playerIndex: 0, sessionToken });
        broadcastLobbyDupla(room);
      } else if (mode === 'grupo') {
        const flavor = msg.flavor === 'familia' ? 'familia' : 'galera';
        const tensionMode = !!msg.tensionMode;
        const questions = buildGrupoQuestionSet({ tensionMode, questionCount, customQuestions });
        const playerId = uid();
        const sessionToken = uid() + uid();
        const room = {
          mode, code, flavor, tensionMode, maxPlayers: MAX_GROUP_PLAYERS,
          players: [{ id: playerId, name, ws, sessionToken }],
          questions, currentIndex: 0, status: 'lobby', hostId: playerId,
          rounds: [{ votes: {}, ready: {}, winnerId: null, skipped: false }],
        };
        rooms.set(code, room);
        ws.roomCode = code; ws.playerId = playerId;
        send(ws, { type: 'room_created', mode, code, playerId, sessionToken });
        broadcastLobbyGrupo(room);
      } else {
        // duelo (1x1)
        const dueloCount = DUELO_COUNT_OPTIONS.includes(msg.questionCount) ? msg.questionCount : DUELO_COUNT_OPTIONS[0];
        const questions = pickDueloQuestions(dueloCount);
        const playerId = uid();
        const sessionToken = uid() + uid();
        const room = {
          mode: 'duelo', code, players: [{ id: playerId, name, ws, sessionToken }],
          questions, status: 'lobby', phase: 'lobby', hostId: playerId,
          setupAnswers: [[], []], setupDoneCount: [0, 0],
          scores: [0, 0], guessDoneCount: [0, 0],
        };
        rooms.set(code, room);
        ws.roomCode = code; ws.playerId = playerId;
        send(ws, { type: 'room_created', mode: 'duelo', code, playerId, sessionToken });
        broadcastLobbyDuelo(room);
      }
      return;
    }

    if (msg.type === 'lookup_room') {
      const room = rooms.get((msg.code || '').toUpperCase());
      if (!room) return send(ws, { type: 'lookup_result', found: false });
      if (room.status !== 'lobby') return send(ws, { type: 'lookup_result', found: true, started: true });
      const payload = room.mode === 'dupla' ? lobbyPayloadDupla(room) : room.mode === 'grupo' ? lobbyPayloadGrupo(room) : lobbyPayloadDuelo(room);
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
        const sessionToken = uid() + uid();
        if (msg.target === 'new') {
          if (room.couples.length >= room.maxCouples) return send(ws, { type: 'error', message: 'Esta partida já está cheia (4 duplas).' });
          const couple = { id: uid(), players: [{ id: playerId, name, gender, ws, sessionToken }], answers: [null, null], ready: [false, false], score: 0, roundScored: false, finalAnswerAt: null };
          room.couples.push(couple);
          ws.roomCode = code; ws.coupleId = couple.id; ws.playerIndex = 0;
          send(ws, { type: 'joined', mode: 'dupla', code, coupleId: couple.id, playerIndex: 0, sessionToken });
        } else {
          const couple = room.couples.find((c) => c.id === msg.target);
          if (!couple || couple.players.length >= 2) return send(ws, { type: 'error', message: 'Essa vaga já foi preenchida.' });
          couple.players.push({ id: playerId, name, gender, ws, sessionToken });
          ws.roomCode = code; ws.coupleId = couple.id; ws.playerIndex = 1;
          send(ws, { type: 'joined', mode: 'dupla', code, coupleId: couple.id, playerIndex: 1, sessionToken });
        }
        broadcastLobbyDupla(room);
      } else if (room.mode === 'grupo') {
        if (room.players.length >= room.maxPlayers) return send(ws, { type: 'error', message: `Esta partida já está cheia (${room.maxPlayers} pessoas).` });
        const playerId = uid();
        const sessionToken = uid() + uid();
        room.players.push({ id: playerId, name, ws, sessionToken });
        ws.roomCode = code; ws.playerId = playerId;
        send(ws, { type: 'joined', mode: 'grupo', code, playerId, sessionToken });
        broadcastLobbyGrupo(room);
      } else {
        if (room.players.length >= 2) return send(ws, { type: 'error', message: 'Esta partida já está cheia (2 pessoas).' });
        const playerId = uid();
        const sessionToken = uid() + uid();
        room.players.push({ id: playerId, name, ws, sessionToken });
        ws.roomCode = code; ws.playerId = playerId;
        send(ws, { type: 'joined', mode: 'duelo', code, playerId, sessionToken });
        broadcastLobbyDuelo(room);
      }
      return;
    }

    if (msg.type === 'rejoin') {
      const code = (msg.code || '').toUpperCase();
      const room = rooms.get(code);
      const token = msg.sessionToken;
      if (!room || !token) return send(ws, { type: 'rejoin_failed' });

      if (room.mode === 'dupla') {
        let foundCouple = null; let foundIdx = -1;
        for (const c of room.couples) {
          const idx = c.players.findIndex((p) => p.sessionToken === token);
          if (idx !== -1) { foundCouple = c; foundIdx = idx; break; }
        }
        if (!foundCouple) return send(ws, { type: 'rejoin_failed' });
        foundCouple.players[foundIdx].ws = ws;
        foundCouple.players[foundIdx].disconnected = false;
        ws.roomCode = code; ws.coupleId = foundCouple.id; ws.playerIndex = foundIdx;
        send(ws, { type: 'rejoin_ok', mode: 'dupla', code, coupleId: foundCouple.id, playerIndex: foundIdx, status: room.status });
        if (room.status === 'lobby') { send(ws, lobbyPayloadDupla(room)); broadcastLobbyDupla(room); }
        else if (room.status === 'playing') send(ws, gamePayloadForDupla(room, foundCouple, foundIdx));
        else send(ws, finishedPayloadDupla(room));
      } else if (room.mode === 'grupo') {
        const p = room.players.find((pl) => pl.sessionToken === token);
        if (!p) return send(ws, { type: 'rejoin_failed' });
        p.ws = ws; p.disconnected = false;
        ws.roomCode = code; ws.playerId = p.id;
        send(ws, { type: 'rejoin_ok', mode: 'grupo', code, playerId: p.id, status: room.status });
        if (room.status === 'lobby') { send(ws, lobbyPayloadGrupo(room)); broadcastLobbyGrupo(room); }
        else if (room.status === 'playing') send(ws, gamePayloadForGrupo(room, p.id));
        else send(ws, finishedPayloadGrupo(room));
      } else {
        // duelo
        const myIdx = room.players.findIndex((pl) => pl.sessionToken === token);
        if (myIdx === -1) return send(ws, { type: 'rejoin_failed' });
        room.players[myIdx].ws = ws;
        room.players[myIdx].disconnected = false;
        ws.roomCode = code; ws.playerId = room.players[myIdx].id;
        send(ws, { type: 'rejoin_ok', mode: 'duelo', code, playerId: room.players[myIdx].id, status: room.status });
        if (room.status === 'lobby') { send(ws, lobbyPayloadDuelo(room)); broadcastLobbyDuelo(room); }
        else if (room.status === 'finished') send(ws, finishedPayloadDuelo(room));
        else if (room.phase === 'setup') {
          const resumeIndex = room.setupAnswers[myIdx].filter((a) => a !== undefined).length;
          send(ws, { type: 'duelo_setup', questions: room.questions, totalQuestions: room.questions.length, resumeIndex });
        } else if (room.phase === 'guess') {
          const resumeIndex = (room.guesses && room.guesses[myIdx] ? room.guesses[myIdx].filter((a) => a !== undefined).length : 0);
          send(ws, { type: 'duelo_guess_start', questions: room.questions.map((q) => ({ text: q.text, options: q.options })), totalQuestions: room.questions.length, resumeIndex });
        }
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
      } else if (room.mode === 'grupo') {
        if (room.hostId !== ws.playerId) return send(ws, { type: 'error', message: 'Só quem criou a sala pode iniciar.' });
        if (room.players.length < MIN_GROUP_PLAYERS) return send(ws, { type: 'error', message: `São necessárias pelo menos ${MIN_GROUP_PLAYERS} pessoas para começar.` });
        room.status = 'playing'; room.currentIndex = 0;
        broadcastGameGrupo(room);
      } else {
        if (room.hostId !== ws.playerId) return send(ws, { type: 'error', message: 'Só quem criou a sala pode iniciar.' });
        if (room.players.length < 2) return send(ws, { type: 'error', message: 'São necessárias 2 pessoas para começar.' });
        room.status = 'playing';
        startDueloSetup(room);
      }
      return;
    }

    if (msg.type === 'answer') {
      const room = rooms.get(ws.roomCode);
      if (!room || room.mode !== 'dupla' || room.status !== 'playing') return;
      const couple = room.couples.find((c) => c.id === ws.coupleId);
      if (!couple || couple.players.length < 2) return;
      if (couple.answers[ws.playerIndex] !== null) return;
      if (msg.choice !== 'EU' && msg.choice !== 'VOCE' && msg.choice !== 'PULAR') return;

      couple.answers[ws.playerIndex] = msg.choice;
      if (couple.answers[0] !== null && couple.answers[1] !== null && !couple.roundScored) {
        const skipped = couple.answers[0] === 'PULAR' || couple.answers[1] === 'PULAR';
        if (!skipped && couple.answers[0] !== couple.answers[1]) couple.score += room.questions[room.currentIndex].value;
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
      if (msg.targetId !== 'PULAR' && !room.players.some((p) => p.id === msg.targetId)) return;
      round.votes[ws.playerId] = msg.targetId;

      const allVoted = room.players.every((p) => round.votes[p.id] !== undefined);
      if (allVoted && round.winnerId === null && !round.skipped) {
        const voteValues = Object.values(round.votes);
        if (voteValues.some((v) => v === 'PULAR')) {
          round.skipped = true;
        } else {
          const counts = {};
          voteValues.forEach((t) => { counts[t] = (counts[t] || 0) + 1; });
          const max = Math.max(...Object.values(counts));
          const topIds = Object.keys(counts).filter((id) => counts[id] === max);
          round.winnerId = topIds.length === 1 ? topIds[0] : null;
        }
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
      } else if (room.mode === 'grupo') {
        const round = room.rounds[room.currentIndex];
        round.ready[ws.playerId] = true;
        broadcastGameGrupo(room);
        maybeAdvanceGrupo(room);
      }
      return;
    }

    if (msg.type === 'setup_answer') {
      const room = rooms.get(ws.roomCode);
      if (!room || room.mode !== 'duelo' || room.phase !== 'setup') return;
      const myIdx = room.players.findIndex((p) => p.id === ws.playerId);
      if (myIdx === -1) return;
      if (!Number.isInteger(msg.index) || msg.index < 0 || msg.index >= room.questions.length) return;
      if (room.setupAnswers[myIdx][msg.index] !== undefined) return; // não permite alterar
      if (!Number.isInteger(msg.choice)) return;
      room.setupAnswers[myIdx][msg.index] = msg.choice;

      const done = room.setupAnswers[myIdx].filter((a) => a !== undefined).length;
      if (done >= room.questions.length) {
        room.setupDoneCount[myIdx] = 1;
        if (room.setupDoneCount[0] && room.setupDoneCount[1]) startDueloGuess(room);
        else send(ws, { type: 'duelo_waiting', phase: 'setup' });
      }
      return;
    }

    if (msg.type === 'guess_answer') {
      const room = rooms.get(ws.roomCode);
      if (!room || room.mode !== 'duelo' || room.phase !== 'guess') return;
      const myIdx = room.players.findIndex((p) => p.id === ws.playerId);
      if (myIdx === -1) return;
      const otherIdx = 1 - myIdx;
      if (!Number.isInteger(msg.index) || msg.index < 0 || msg.index >= room.questions.length) return;
      if (!room.guesses) room.guesses = [[], []];
      if (room.guesses[myIdx][msg.index] !== undefined) return;
      if (!Number.isInteger(msg.choice)) return;
      room.guesses[myIdx][msg.index] = msg.choice;

      const actualChoice = room.setupAnswers[otherIdx][msg.index];
      const correct = actualChoice === msg.choice;
      if (correct) room.scores[myIdx] += 1;
      send(ws, { type: 'duelo_guess_result', index: msg.index, correct, actualChoice });

      const doneCount = room.guesses[myIdx].filter((a) => a !== undefined).length;
      if (doneCount >= room.questions.length) {
        room.guessDoneCount[myIdx] = 1;
        if (room.guessDoneCount[0] && room.guessDoneCount[1]) finishDuelo(room);
        else send(ws, { type: 'duelo_waiting', phase: 'guess' });
      }
      return;
    }

    if (msg.type === 'chat_send') {
      const room = rooms.get(ws.roomCode);
      if (!room) return;
      const text = String(msg.text || '').trim().slice(0, 300);
      if (!text) return;
      let senderName = 'Alguém';
      if (room.mode === 'dupla') {
        const couple = room.couples.find((c) => c.id === ws.coupleId);
        if (couple) senderName = couple.players[ws.playerIndex].name;
      } else {
        const p = room.players.find((pl) => pl.id === ws.playerId);
        if (p) senderName = p.name;
      }
      broadcastChat(room, senderName, text);
      return;
    }

    if (msg.type === 'leave') {
      const room = rooms.get(ws.roomCode);
      if (!room) return;
      if (room.mode === 'dupla') {
        const idx = room.couples.findIndex((c) => c.id === ws.coupleId);
        if (idx === -1) return;
        const couple = room.couples[idx];
        couple.players.forEach((p) => { if (p.ws !== ws) send(p.ws, { type: 'kicked', message: 'Sua dupla saiu da partida.' }); });
        room.couples.splice(idx, 1);
        if (room.status === 'lobby') broadcastLobbyDupla(room);
      } else if (room.mode === 'grupo') {
        room.players = room.players.filter((p) => p.id !== ws.playerId);
        if (room.status === 'lobby') broadcastLobbyGrupo(room);
      } else {
        const idx = room.players.findIndex((p) => p.id === ws.playerId);
        if (idx !== -1) {
          const other = room.players[1 - idx];
          if (other) send(other.ws, { type: 'kicked', message: 'O outro jogador saiu da partida.' });
          room.players.splice(idx, 1);
        }
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
    } else if (room.mode === 'grupo') {
      const p = room.players.find((pl) => pl.id === ws.playerId);
      if (p) p.disconnected = true;
      if (room.status === 'lobby') broadcastLobbyGrupo(room);
    } else {
      const p = room.players.find((pl) => pl.id === ws.playerId);
      if (p) p.disconnected = true;
      if (room.status === 'lobby') broadcastLobbyDuelo(room);
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
    themes: THEMES.map((t) => ({ id: t.id, name: t.name, icon: t.icon, count: t.questions.length, total: t.questions.length + t.tension.length, rankingPoints: t.rankingPoints })),
    questionCountOptions: QUESTION_COUNT_OPTIONS,
    dueloCountOptions: DUELO_COUNT_OPTIONS,
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('ConectAí rodando em http://localhost:' + PORT);
});
