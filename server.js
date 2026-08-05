const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const dbDir = path.join(__dirname, 'data');
const dbPath = path.join(dbDir, 'rooms.db');
fs.mkdirSync(dbDir, { recursive: true });
const db = new Database(dbPath);
db.prepare(`
  CREATE TABLE IF NOT EXISTS rooms (
    code TEXT PRIMARY KEY,
    host_name TEXT NOT NULL,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`).run();

const CODE_CHARS = '0123456789';
function createRoomCode() {
  let code = '';
  for (let i = 0; i < 4; i += 1) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

function createRoomState(roomCode, hostName) {
  return {
    roomCode,
    hostId: null,
    hostName,
    players: [],
    logs: [],
    createdAt: Date.now(),
  };
}

function saveRoom(room) {
  db.prepare(`
    INSERT INTO rooms(code, host_name, state_json, updated_at)
    VALUES(?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      host_name = excluded.host_name,
      state_json = excluded.state_json,
      updated_at = excluded.updated_at
  `).run(room.roomCode, room.hostName, JSON.stringify(room), new Date().toISOString());
}

function getRoom(roomCode) {
  const row = db.prepare('SELECT state_json FROM rooms WHERE code = ?').get(roomCode);
  if (!row) return null;
  return JSON.parse(row.state_json);
}

function deleteRoom(roomCode) {
  db.prepare('DELETE FROM rooms WHERE code = ?').run(roomCode);
}

function emitRoomState(roomCode) {
  const room = getRoom(roomCode);
  if (!room) return;
  io.to(roomCode).emit('room-state', {
    roomCode,
    hostName: room.hostName,
    hostId: room.hostId,
    players: room.players,
    logs: room.logs,
  });
}

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

io.on('connection', (socket) => {
  socket.on('create-room', ({ hostName }) => {
    let roomCode = createRoomCode();
    while (getRoom(roomCode)) {
      roomCode = createRoomCode();
    }

    const room = createRoomState(roomCode, hostName);
    room.players.push({
      id: socket.id,
      name: hostName,
      score: 0,
      isHost: true,
    });
    room.hostId = socket.id;
    saveRoom(room);

    socket.join(roomCode);
    socket.emit('room-created', {
      roomCode,
      hostName,
      players: room.players,
      logs: room.logs,
    });
  });

  socket.on('join-room', ({ roomCode, playerName }) => {
    const room = getRoom(roomCode);
    if (!room) {
      socket.emit('room-error', { message: '房间不存在' });
      return;
    }

    const existing = room.players.find((player) => player.name === playerName);
    if (existing) {
      socket.emit('room-error', { message: '昵称已存在' });
      return;
    }

    const player = {
      id: socket.id,
      name: playerName,
      score: 0,
      isHost: false,
    };
    room.players.push(player);
    saveRoom(room);
    socket.join(roomCode);

    emitRoomState(roomCode);
  });

  socket.on('rejoin-room', ({ roomCode, playerName }) => {
    const room = getRoom(roomCode);
    if (!room) {
      socket.emit('room-error', { message: '房间不存在或已解散' });
      return;
    }

    const existing = room.players.find((player) => player.name === playerName);
    if (!existing) {
      socket.emit('room-error', { message: '无法找到该玩家，请重新加入房间' });
      return;
    }

    existing.id = socket.id;
    socket.join(roomCode);

    if (room.hostName === playerName) {
      room.hostId = socket.id;
    }

    saveRoom(room);
    emitRoomState(roomCode);
  });

  socket.on('transfer-score', ({ roomCode, fromId, toId, amount }) => {
    const room = getRoom(roomCode);
    if (!room) return;

    const fromPlayer = room.players.find((player) => player.id === fromId);
    const toPlayer = room.players.find((player) => player.id === toId);
    if (!fromPlayer || !toPlayer || fromPlayer.id === toPlayer.id) return;

    fromPlayer.score -= amount;
    toPlayer.score += amount;
    room.logs.unshift({
      id: `${Date.now()}`,
      from: fromPlayer.name,
      to: toPlayer.name,
      amount,
      timestamp: new Date().toLocaleString('zh-CN', { hour12: false }),
    });
    saveRoom(room);
    emitRoomState(roomCode);
  });

  socket.on('reset-room', ({ roomCode }) => {
    const room = getRoom(roomCode);
    if (!room) {
      socket.emit('room-error', { message: '房间不存在' });
      return;
    }
    if (room.hostId !== socket.id) {
      socket.emit('room-error', { message: '只有房主可以重置房间' });
      return;
    }

    room.players = room.players.map((player) => ({ ...player, score: 0 }));
    room.logs = [];
    saveRoom(room);
    emitRoomState(roomCode);
  });

  socket.on('reset-score', ({ roomCode }) => {
    const room = getRoom(roomCode);
    if (!room) {
      socket.emit('room-error', { message: '房间不存在' });
      return;
    }
    if (room.hostId !== socket.id) {
      socket.emit('room-error', { message: '只有房主可以重置分数' });
      return;
    }

    room.players = room.players.map((player) => ({ ...player, score: 0 }));
    room.logs = [];
    saveRoom(room);
    emitRoomState(roomCode);
  });

  socket.on('disconnect', () => {
    const roomsRows = db.prepare('SELECT code, state_json FROM rooms').all();
    for (const row of roomsRows) {
      const room = JSON.parse(row.state_json);
      const playerIndex = room.players.findIndex((player) => player.id === socket.id);
      if (playerIndex !== -1) {
        const lostHost = room.hostId === socket.id;
        room.players.splice(playerIndex, 1);
        if (lostHost) {
          room.players = room.players.map((player) => ({ ...player, isHost: false }));
        }
        if (room.players.length === 0) {
          deleteRoom(room.roomCode);
        } else {
          if (lostHost) {
            room.hostId = room.players[0].id;
            room.hostName = room.players[0].name;
            room.players[0].isHost = true;
          }
          saveRoom(room);
          emitRoomState(room.roomCode);
        }
        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
