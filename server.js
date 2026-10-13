const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { randomUUID, randomInt, scryptSync, timingSafeEqual } = require('crypto');
const Database = require('better-sqlite3');
const { Server } = require('socket.io');
const core = require('./score-core');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const dbDir = path.join(__dirname, 'data');
fs.mkdirSync(dbDir, { recursive: true });
const db = new Database(process.env.SCORE_DB_PATH || path.join(dbDir, 'rooms.db'));
db.prepare('CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, host_name TEXT NOT NULL, state_json TEXT NOT NULL, updated_at TEXT NOT NULL)').run();
// Persist an offline grace period across a server restart.
for (const row of db.prepare('SELECT state_json FROM rooms').all()) {
  const room = JSON.parse(row.state_json);
  if (room.hostId && !room.hostOfflineSince) { room.hostOfflineSince = Date.now(); saveRoom(room); }
}
function getRoom(code) {
  if (typeof code !== 'string' || !/^\d{4}$/.test(code)) return null;
  const row = db.prepare('SELECT state_json FROM rooms WHERE code = ?').get(code);
  if (!row) return null;
  const room = JSON.parse(row.state_json);
  // Existing IDs become stable IDs; never replace a player ID on reconnection.
  if (room.schemaVersion !== 2) {
    room.players.forEach(p => { p.socketId = p.id; p.left = false; });
    room.schemaVersion = 2;
    saveRoom(room);
  }
  return room;
}
function saveRoom(room) {
  db.prepare('INSERT INTO rooms VALUES (?, ?, ?, ?) ON CONFLICT(code) DO UPDATE SET host_name=excluded.host_name, state_json=excluded.state_json, updated_at=excluded.updated_at').run(room.roomCode, room.hostName || '', JSON.stringify(room), new Date().toISOString());
}
function isOnline(player) {
  const connection = io.sockets.sockets.get(player.socketId);
  return Boolean(!player.left && connection && connection.data.playerId === player.id);
}
function publicState(room) {
  return { roomCode: room.roomCode, hostName: room.hostName, hostId: room.hostId, createdAt: room.createdAt,
    players: room.players.map(({ token, socketId, ...player }) => ({ ...player, online: isOnline({ ...player, socketId }) })),
    logs: room.logs, locked: Boolean(room.locked), hasPassword: Boolean(room.passwordHash), round: room.round || 1, rounds: room.rounds || [], hostOfflineSince: room.hostOfflineSince || null };
}
function broadcast(room) { io.to(room.roomCode).emit('room-state', publicState(room)); }
function name(value) {
  if (typeof value !== 'string' || !value.trim() || Array.from(value.trim()).length > 8) throw new Error('昵称需为 1 到 8 个字符');
  return value.trim();
}
function avatarValue(value) {
  if (value === undefined) return '♠';
  if (!['😀','😊','😂','😎','🤔','😴','☀️','☁️','🌧️','❄️','🐻','🐹','昵称', '♠', '♥', '♦', '♣', '🐱', '🐼', '🐶', '🦊', '🐯', '🐰', '🐸', '🐨', '🦁', '🐵', '🐧', '🦉', '🌙', '⭐', '🌻', '🍀', '🔥', '🌊', '🎲', '🎯'].includes(value)) throw new Error('请选择有效头像');
  return value;
}
function avatarColorValue(value) {
  if (value == null || value === '') return null;
  if (!['#a66b58','#9a9255','#357960','#3b72b8','#8056ad','#ba5076','#b66b32','#497f88','#a54949','#64748b','#748b75','#69869c','#8e7c9f','#a67d87','#a18b72','#85865e','#608e89','#706c91'].includes(value)) throw new Error('请选择有效头像底色');
  return value;
}
function setHost(room, player) {
  room.hostId = player?.id || null; room.hostName = player?.name || ''; room.hostOfflineSince = null;
  room.players.forEach(p => { p.isHost = p.id === room.hostId; });
}
for (const file of ['index.html', 'script.js', 'styles.css', 'score-core.js']) {
  app.get(file === 'index.html' ? '/' : '/' + file, (req, res) => res.sendFile(path.join(__dirname, file)));
}
app.use('/image', express.static(path.join(__dirname, 'image')));
app.get('/health', (req, res) => res.json({ ok: true }));
io.on('connection', socket => {
  function on(event, handler) {
    socket.on(event, (payload = {}, ack) => {
      try {
        if (!payload || typeof payload !== 'object') throw new Error('请求格式错误');
        handler(payload);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (error) {
        socket.emit('room-error', { message: error.message, event });
        if (typeof ack === 'function') ack({ ok: false, message: error.message });
      }
    });
  }
  function requireLobby() { if (socket.data.roomCode) throw new Error('请先退出当前房间'); }
  function member(code, hostOnly = false) {
    const room = getRoom(code);
    if (!room) throw new Error('房间不存在或已解散');
    const player = room.players.find(p => p.id === socket.data.playerId && p.socketId === socket.id && !p.left);
    if (socket.data.roomCode !== code || !player) throw new Error('请先加入房间');
    if (hostOnly && room.hostId !== player.id) throw new Error('只有房主可以操作');
    return room;
  }
  function enter(room, player) {
    if (player.removed) throw new Error('你已被房主移出，请重新加入房间');
    player.socketId = socket.id; player.left = false;
    if (room.hostId === player.id) room.hostOfflineSince = null;
    if (!room.hostId) setHost(room, player);
    socket.data.roomCode = room.roomCode; socket.data.playerId = player.id;
    socket.join(room.roomCode); saveRoom(room);
    socket.emit('session-token', { token: player.token, playerId: player.id });
  }
  on('create-room', ({ hostName, avatar, avatarColor }) => {
    requireLobby(); hostName = name(hostName); avatar = avatarValue(avatar);
    let roomCode;
    for (let attempt = 0; attempt < 10000; attempt++) {
      const candidate = String(randomInt(10000)).padStart(4, '0');
      if (!getRoom(candidate)) { roomCode = candidate; break; }
    }
    if (!roomCode) throw new Error('房间已满，请稍后再试');
    const player = { id: randomUUID(), name: hostName, avatar, avatarColor: avatarColorValue(avatarColor), score: 0, isHost: true, token: randomUUID() };
    const room = { roomCode, hostName, hostId: player.id, players: [player], logs: [], createdAt: Date.now(), schemaVersion: 2 };
    enter(room, player); socket.emit('room-created', publicState(room));
  });
  on('join-room', ({ roomCode, playerName, avatar, avatarColor, password }) => {
    requireLobby(); playerName = name(playerName); avatar = avatarValue(avatar);
    const room = getRoom(roomCode);
    if (!room) throw new Error('房间不存在或已解散');
    if (room.locked) throw new Error('房主已锁定加入，请联系房主解锁');
    if (room.passwordHash && (typeof password !== 'string' || password.length > 32 || !timingSafeEqual(Buffer.from(room.passwordHash, 'hex'), scryptSync(password, room.passwordSalt, 32)))) throw new Error('房间密码不正确');
    if (room.players.length >= 8) throw new Error('房间最多支持 8 位玩家（含保留账目的席位）');
    if (room.players.some(p => p.name === playerName)) throw new Error('昵称已存在，请使用原设备恢复或更换昵称');
    const player = { id: randomUUID(), name: playerName, avatar, avatarColor: avatarColorValue(avatarColor), score: 0, isHost: false, token: randomUUID() };
    room.players.push(player); enter(room, player); broadcast(room);
  });
  on('rejoin-room', ({ roomCode, token }) => {
    requireLobby();
    const room = getRoom(roomCode);
    const player = room?.players.find(p => typeof token === 'string' && p.token === token);
    if (!player) throw new Error('会话已失效，请重新创建或加入房间');
    const oldSocket = io.sockets.sockets.get(player.socketId);
    if (oldSocket && oldSocket !== socket) {
      oldSocket.leave(roomCode); oldSocket.data.roomCode = null; oldSocket.data.playerId = null;
      oldSocket.emit('session-replaced', { message: '此席位已在另一个窗口恢复，请使用该窗口继续记分' });
    }
    enter(room, player); broadcast(room);
  });
  on('transfer-score', ({ roomCode, fromId, toId, amount, requestId }) => {
    const room = member(roomCode);
    if (typeof requestId !== 'string' || !/^[\w-]{8,80}$/.test(requestId)) throw new Error('记分请求无效，请刷新页面');
    // IDs are persisted with the room, including after undo, reset and restarts.
    room.requests ||= [];
    const requestKey = socket.data.playerId + ':' + requestId;
    if (room.requests.includes(requestKey)) { broadcast(room); return; }
    if (room.hostId !== socket.data.playerId && fromId !== socket.data.playerId) throw new Error('普通玩家只能从自己转出积分');
    if (room.players.some(p => (p.id === fromId || p.id === toId) && p.left)) throw new Error('已离开的成员只能参与结算');
    const entry = core.transfer(room.players, fromId, toId, amount);
    room.logs.unshift({ ...entry, id: `${Date.now()}-${randomUUID()}`, operatorId: socket.data.playerId, timestamp: new Date().toLocaleString('zh-CN', { hour12: false }) });
    room.requests.push(requestKey); room.requests = room.requests.slice(-1000);
    saveRoom(room); broadcast(room);
  });
  on('update-profile', ({ roomCode, playerName, avatar, avatarColor }) => {
    const room = member(roomCode); playerName = name(playerName); avatar = avatarValue(avatar);
    const color = avatarColorValue(avatarColor);
    const player = room.players.find(p => p.id === socket.data.playerId);
    if (room.players.some(p => p !== player && p.name === playerName)) throw new Error('昵称已存在');
    const oldName = player.name;
    room.logs.forEach(log => { if (log.from === oldName) log.from = playerName; if (log.to === oldName) log.to = playerName; });
    player.name = playerName; player.avatar = avatar; player.avatarColor = color;
    if (player.isHost) room.hostName = playerName;
    saveRoom(room); socket.emit('profile-updated', { playerName, avatar, avatarColor: color }); broadcast(room);
  });
  on('undo-score', ({ roomCode, logId }) => {
    const room = member(roomCode, true); const log = room.logs[0];
    if (!log || log.id !== logId) throw new Error('记录已变化，请重新选择撤销');
    const from = room.players.find(p => p.id === log.fromId) || room.players.find(p => p.name === log.from);
    const to = room.players.find(p => p.id === log.toId) || room.players.find(p => p.name === log.to);
    core.transfer(room.players, to.id, from.id, log.amount);
    room.logs.shift(); saveRoom(room); broadcast(room);
  });
  on('reset-score', ({ roomCode }) => {
    const room = member(roomCode, true);
    room.players.forEach(p => { p.score = 0; }); room.logs = [];
    room.players = room.players.filter(p => !p.left);
    saveRoom(room); broadcast(room);
  });
  on('room-settings', ({ roomCode, locked, password }) => {
    const room = member(roomCode, true);
    if (typeof locked !== 'boolean' || typeof password !== 'string' || password.length > 32) throw new Error('密码最多 32 个字符');
    room.locked = locked;
    if (password) { room.passwordSalt = randomUUID(); room.passwordHash = scryptSync(password, room.passwordSalt, 32).toString('hex'); }
    saveRoom(room); broadcast(room);
  });
  on('remove-password', ({ roomCode }) => {
    const room = member(roomCode, true); delete room.passwordHash; delete room.passwordSalt; saveRoom(room); broadcast(room);
  });
  on('next-round', ({ roomCode, round }) => {
    const room = member(roomCode, true);
    if (round !== (room.round || 1)) throw new Error('已开始下一局，请刷新结算');
    if (!room.logs.length) throw new Error('本局还没有记录');
    room.rounds ||= [];
    room.rounds.unshift({ number: room.round || 1, endedAt: new Date().toISOString(), players: room.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, avatarColor: p.avatarColor, score: p.score })), logs: room.logs });
    room.round = (room.round || 1) + 1; room.logs = []; room.players = room.players.filter(p => !p.left);
    room.players.forEach(p => { p.score = 0; }); saveRoom(room); broadcast(room);
  });
  on('remove-player', ({ roomCode, playerId }) => {
    const room = member(roomCode, true); const player = room.players.find(p => p.id === playerId && p.id !== room.hostId && !p.left);
    if (!player) throw new Error('请选择其他在场成员');
    const connection = io.sockets.sockets.get(player.socketId);
    if (connection) { connection.leave(roomCode); connection.data.roomCode = null; connection.data.playerId = null; connection.emit('room-closed', { message: '你已被房主移出房间' }); }
    player.left = true; player.removed = true; player.token = randomUUID();
    if (!player.score && !room.logs.some(l => l.fromId === player.id || l.toId === player.id || l.from === player.name || l.to === player.name)) room.players = room.players.filter(p => p.id !== playerId);
    saveRoom(room); broadcast(room);
  });
  on('claim-host', ({ roomCode }) => {
    const room = member(roomCode); const host = room.players.find(p => p.id === room.hostId);
    if (host && (isOnline(host) || !room.hostOfflineSince || Date.now() - room.hostOfflineSince < 120000)) throw new Error('房主离线满 2 分钟后才可接管');
    setHost(room, room.players.find(p => p.id === socket.data.playerId)); saveRoom(room); broadcast(room);
  });
  on('reset-room', ({ roomCode }) => {
    member(roomCode, true);
    io.to(roomCode).emit('room-closed', { message: '房主已解散房间' });
    for (const connection of io.sockets.sockets.values()) if (connection.data.roomCode === roomCode) {
      connection.leave(roomCode); connection.data.roomCode = null; connection.data.playerId = null;
    }
    db.prepare('DELETE FROM rooms WHERE code = ?').run(roomCode);
  });
  on('transfer-host', ({ roomCode, playerId }) => {
    const room = member(roomCode, true);
    const next = room.players.find(p => p.id === playerId && p.id !== room.hostId && isOnline(p));
    if (!next) throw new Error('请选择另一位在线玩家');
    setHost(room, next); saveRoom(room); broadcast(room);
  });
  on('leave-room', ({ roomCode }) => {
    const room = member(roomCode); const player = room.players.find(p => p.id === socket.data.playerId);
    player.left = true;
    socket.leave(roomCode); socket.data.roomCode = null; socket.data.playerId = null;
    if (room.hostId === player.id) setHost(room, room.players.find(p => !p.left && isOnline(p)) || room.players.find(p => !p.left));
    // Keep any player referenced by the ledger, even with a zero balance.
    if (player.score === 0 && !room.logs.some(l => l.fromId === player.id || l.toId === player.id || l.from === player.name || l.to === player.name)) room.players = room.players.filter(p => p.id !== player.id);
    saveRoom(room); socket.emit('room-left', { roomCode, canRestore: room.players.some(p => p.id === player.id) }); broadcast(room);
  });
  socket.on('disconnect', () => {
    if (!socket.data.roomCode) return;
    const room = getRoom(socket.data.roomCode);
    if (room) { if (room.hostId === socket.data.playerId) { room.hostOfflineSince = Date.now(); saveRoom(room); } broadcast(room); }
  });
});
if (require.main === module) server.listen(process.env.PORT || 3000, () => console.log('Score server ready'));
module.exports = { app, server, io, db };
