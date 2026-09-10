const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const QUESTIONS = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf8'));
const MAX_COUPLES = 4;

// Estado das salas em memória (sem banco de dados, conforme especificação).
const rooms = new Map();

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function shuffledOrder() {
  const arr = QUESTIONS.map((_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function send(ws, obj) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

function lobbyPayload(room) {
  return {
    type: 'lobby_state',
    code: room.code,
    maxCouples: room.maxCouples,
    hostCoupleId: room.hostCoupleId,
    couples: room.couples.map((c) => ({
      id: c.id,
      players: c.players.map((p) => ({ name: p.name, gender: p.gender })),
      complete: c.players.length === 2,
    })),
  };
}

function broadcastLobby(room) {
  const payload = lobbyPayload(room);
  room.couples.forEach((c) => c.players.forEach((p) => send(p.ws, payload)));
}

function scoreboardFor(room, forCoupleId) {
  return room.couples
    .filter((c) => c.players.length === 2)
    .map((c) => ({
      coupleId: c.id,
      names: c.players.map((p) => p.name).join(' & '),
      score: c.score,
      mine: c.id === forCoupleId,
    }))
    .sort((a, b) => b.score - a.score);
}

function gamePayloadFor(room, couple, playerIndex) {
  if (!couple || couple.players.length < 2) {
    return { type: 'game_state', incomplete: true };
  }
  const partnerIndex = 1 - playerIndex;
  const me = couple.players[playerIndex];
  const partner = couple.players[partnerIndex];
  const qId = room.order[room.currentIndex];
  const myAnswer = couple.answers[playerIndex];
  const partnerAnswer = couple.answers[partnerIndex];
  const revealed = myAnswer !== null && partnerAnswer !== null;

  return {
    type: 'game_state',
    incomplete: false,
    questionIndex: room.currentIndex,
    totalQuestions: QUESTIONS.length,
    questionText: QUESTIONS[qId].text,
    myGender: me.gender,
    partnerGender: partner.gender,
    partnerName: partner.name,
    myAnswer,
    partnerAnswer: revealed ? partnerAnswer : null,
    revealed,
    match: revealed ? myAnswer !== partnerAnswer : null,
    myReady: couple.ready[playerIndex],
    partnerReady: couple.ready[partnerIndex],
    score: couple.score,
    scoreboard: scoreboardFor(room, couple.id),
  };
}

function broadcastGame(room) {
  room.couples.forEach((c) => {
    c.players.forEach((p, idx) => send(p.ws, gamePayloadFor(room, c, idx)));
  });
}

function finishedPayload(room) {
  const ranked = room.couples
    .filter((c) => c.players.length === 2)
    .map((c) => ({ names: c.players.map((p) => p.name).join(' & '), score: c.score }))
    .sort((a, b) => b.score - a.score);
  return { type: 'game_finished', results: ranked, total: QUESTIONS.length };
}

function broadcastFinished(room) {
  const payload = finishedPayload(room);
  room.couples.forEach((c) => c.players.forEach((p) => send(p.ws, payload)));
}

function maybeAdvance(room) {
  const playable = room.couples.filter((c) => c.players.length === 2);
  if (playable.length === 0) return;
  const allReady = playable.every((c) => c.ready[0] && c.ready[1]);
  if (!allReady) return;

  room.currentIndex += 1;
  if (room.currentIndex >= room.order.length) {
    room.status = 'finished';
    broadcastFinished(room);
  } else {
    room.couples.forEach((c) => {
      c.answers = [null, null];
      c.ready = [false, false];
      c.roundScored = false;
    });
    broadcastGame(room);
  }
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }

    // --- Criar partida ---
    if (msg.type === 'create_room') {
      const name = (msg.name || '').trim().slice(0, 30);
      const gender = msg.gender === 'M' ? 'M' : 'F';
      if (!name) return send(ws, { type: 'error', message: 'Digite seu nome.' });

      const code = genCode();
      const playerId = uid();
      const couple = {
        id: uid(),
        players: [{ id: playerId, name, gender, ws }],
        answers: [null, null],
        ready: [false, false],
        score: 0,
        roundScored: false,
      };
      const room = {
        code,
        maxCouples: MAX_COUPLES,
        couples: [couple],
        order: shuffledOrder(),
        currentIndex: 0,
        status: 'lobby',
        hostCoupleId: couple.id,
      };
      rooms.set(code, room);

      ws.roomCode = code;
      ws.coupleId = couple.id;
      ws.playerIndex = 0;

      send(ws, { type: 'room_created', code, coupleId: couple.id, playerIndex: 0 });
      broadcastLobby(room);
      return;
    }

    // --- Consultar uma sala antes de entrar ---
    if (msg.type === 'lookup_room') {
      const room = rooms.get((msg.code || '').toUpperCase());
      if (!room) return send(ws, { type: 'lookup_result', found: false });
      if (room.status !== 'lobby') return send(ws, { type: 'lookup_result', found: true, started: true });
      send(ws, Object.assign({ type: 'lookup_result', found: true, started: false }, lobbyPayload(room)));
      return;
    }

    // --- Entrar em uma partida ---
    if (msg.type === 'join_room') {
      const code = (msg.code || '').toUpperCase();
      const room = rooms.get(code);
      if (!room) return send(ws, { type: 'error', message: 'Partida não encontrada.' });
      if (room.status !== 'lobby') return send(ws, { type: 'error', message: 'Esta partida já começou.' });

      const name = (msg.name || '').trim().slice(0, 30);
      const gender = msg.gender === 'M' ? 'M' : 'F';
      if (!name) return send(ws, { type: 'error', message: 'Digite seu nome.' });

      const playerId = uid();

      if (msg.target === 'new') {
        if (room.couples.length >= room.maxCouples) {
          return send(ws, { type: 'error', message: 'Esta partida já está cheia (4 casais).' });
        }
        const couple = {
          id: uid(),
          players: [{ id: playerId, name, gender, ws }],
          answers: [null, null],
          ready: [false, false],
          score: 0,
          roundScored: false,
        };
        room.couples.push(couple);
        ws.roomCode = code;
        ws.coupleId = couple.id;
        ws.playerIndex = 0;
        send(ws, { type: 'joined', code, coupleId: couple.id, playerIndex: 0 });
      } else {
        const couple = room.couples.find((c) => c.id === msg.target);
        if (!couple || couple.players.length >= 2) {
          return send(ws, { type: 'error', message: 'Essa vaga já foi preenchida.' });
        }
        couple.players.push({ id: playerId, name, gender, ws });
        ws.roomCode = code;
        ws.coupleId = couple.id;
        ws.playerIndex = 1;
        send(ws, { type: 'joined', code, coupleId: couple.id, playerIndex: 1 });
      }

      broadcastLobby(room);
      return;
    }

    // --- Iniciar o jogo (apenas o jogador que criou a sala) ---
    if (msg.type === 'start_game') {
      const room = rooms.get(ws.roomCode);
      if (!room) return;
      if (room.hostCoupleId !== ws.coupleId || ws.playerIndex !== 0) {
        return send(ws, { type: 'error', message: 'Só quem criou a sala pode iniciar o jogo.' });
      }
      const complete = room.couples.filter((c) => c.players.length === 2);
      if (complete.length === 0) {
        return send(ws, { type: 'error', message: 'Pelo menos um casal precisa estar completo para começar.' });
      }
      room.status = 'playing';
      room.currentIndex = 0;
      broadcastGame(room);
      return;
    }

    // --- Responder EU / VOCÊ ---
    if (msg.type === 'answer') {
      const room = rooms.get(ws.roomCode);
      if (!room || room.status !== 'playing') return;
      const couple = room.couples.find((c) => c.id === ws.coupleId);
      if (!couple || couple.players.length < 2) return;
      if (couple.answers[ws.playerIndex] !== null) return; // não permite alterar resposta
      if (msg.choice !== 'EU' && msg.choice !== 'VOCE') return;

      couple.answers[ws.playerIndex] = msg.choice;

      if (couple.answers[0] !== null && couple.answers[1] !== null && !couple.roundScored) {
        if (couple.answers[0] !== couple.answers[1]) couple.score += 1;
        couple.roundScored = true;
      }
      broadcastGame(room);
      return;
    }

    // --- Confirmar "Próxima" ---
    if (msg.type === 'ready') {
      const room = rooms.get(ws.roomCode);
      if (!room || room.status !== 'playing') return;
      const couple = room.couples.find((c) => c.id === ws.coupleId);
      if (!couple) return;
      couple.ready[ws.playerIndex] = true;
      broadcastGame(room);
      maybeAdvance(room);
      return;
    }
  });

  ws.on('close', () => {
    const room = rooms.get(ws.roomCode);
    if (!room) return;
    const couple = room.couples.find((c) => c.id === ws.coupleId);
    if (couple) {
      const player = couple.players[ws.playerIndex];
      if (player) player.disconnected = true;
    }
    if (room.status === 'lobby') broadcastLobby(room);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('NA MESMA rodando em http://localhost:' + PORT);
});
