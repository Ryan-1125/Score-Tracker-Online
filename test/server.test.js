const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
process.env.SCORE_DB_PATH = ':memory:';
const { server, io, db } = require('../server');
global.self = globalThis;
global.WebSocket = require('ws');
const client = require('../node_modules/socket.io/client-dist/socket.io.js');
function event(socket, name, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, listener); reject(new Error('Timed out: ' + name)); }, 3000);
    function listener(value) { if (!predicate(value)) return; socket.off(name, listener); clearTimeout(timer); resolve(value); }
    socket.on(name, listener);
  });
}
function command(socket, name, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Missing acknowledgement: ' + name)), 3000);
    socket.emit(name, payload, result => { clearTimeout(timer); resolve(result); });
  });
}
test('online room lifecycle', async t => {
  const sockets = [];
  try {
    server.listen(0); await once(server, 'listening');
    const url = 'http://127.0.0.1:' + server.address().port;
    async function connect() {
      const socket = client(url, { transports: ['websocket'], reconnection: false });
      sockets.push(socket); await event(socket, 'connect'); return socket;
    }
    const host = await connect(), guest = await connect(), outsider = await connect();
    const hostSessionPromise = event(host, 'session-token');
    const created = event(host, 'room-created');
    assert.equal((await command(host, 'create-room', { hostName: '甲', avatarColor: '#3b72b8' })).ok, true);
    let room = await created; const hostSession = await hostSessionPromise;
    const code = room.roomCode, hostId = hostSession.playerId;
    const guestSessionPromise = event(guest, 'session-token');
    let updated = event(guest, 'room-state');
    await command(guest, 'join-room', { roomCode: code, playerName: '乙', avatarColor: '#ba5076' }); room = await updated;
    const guestSession = await guestSessionPromise, guestId = guestSession.playerId;
    const transfer = { roomCode: code, fromId: hostId, toId: guestId, amount: 5, requestId: 'request-0001' };
    await t.test('stable identity and public state excludes credentials', () => {
      assert.equal(room.hostId, hostId); assert.notEqual(hostId, host.id);
      assert.equal(room.players[0].token, undefined); assert.equal(room.players[0].socketId, undefined);
      assert.deepEqual(room.players.map(p=>p.online), [true,true]);
      assert.deepEqual(room.players.map(p=>p.avatarColor), ['#3b72b8','#ba5076']);
    });
    await t.test('unauthorized clients and invalid values cannot write', async () => {
      assert.equal((await command(outsider,'transfer-score',transfer)).ok,false);
      assert.equal((await command(guest,'transfer-score',transfer)).ok,false);
      assert.equal((await command(guest,'reset-score',{roomCode:code})).ok,false);
      assert.equal((await command(outsider,'rejoin-room',{roomCode:code,token:'fake-token'})).ok,false);
      for(const amount of [-1,1.5,'5',1000001]) assert.equal((await command(host,'transfer-score',{...transfer,amount})).ok,false);
    });
    await t.test('duplicate requests are recorded once', async () => {
      updated=event(host,'room-state'); await command(host,'transfer-score',transfer); room=await updated;
      updated=event(host,'room-state'); await command(host,'transfer-score',transfer); room=await updated;
      assert.deepEqual(room.players.map(p=>p.score),[-5,5]); assert.equal(room.logs.length,1);
    });
    await t.test('rename preserves scores and ledger identity', async () => {
      updated=event(host,'room-state'); await command(host,'update-profile',{roomCode:code,playerName:'新甲',avatar:'🐼',avatarColor:'#357960'}); room=await updated;
      assert.equal(room.players[0].avatar,'🐼'); assert.equal(room.logs[0].from,'新甲'); assert.equal(room.logs[0].fromId,hostId);
      assert.equal((await command(guest,'update-profile',{roomCode:code,playerName:'新甲',avatar:'♠'})).ok,false);
      assert.equal((await command(guest,'update-profile',{roomCode:code,playerName:'乙',avatar:'bad'})).ok,false);
      assert.equal(room.players[0].avatarColor,'#357960');
      assert.equal((await command(host,'update-profile',{roomCode:code,playerName:'新甲',avatar:'🐼',avatarColor:'red;invalid'})).ok,false);
    });
    let restored;
    await t.test('disconnect and refresh keep identity and balance', async () => {
      updated=event(guest,'room-state'); host.disconnect(); room=await updated;
      assert.equal(room.players[0].online,false);
      restored=await connect(); updated=event(restored,'room-state');
      await command(restored,'rejoin-room',{roomCode:code,token:hostSession.token}); room=await updated;
      assert.equal(room.hostId,hostId); assert.equal(room.players[0].id,hostId); assert.equal(room.players[0].score,-5);
      assert.equal(room.players[0].avatarColor,'#357960');
    });
    await t.test('one connection cannot join multiple rooms', async () => {
      assert.equal((await command(restored,'create-room',{hostName:'重复'})).ok,false);
      assert.equal(db.prepare('SELECT count(*) AS total FROM rooms').get().total,1);
    });
    await t.test('host transfer updates authorization for both clients', async () => {
      updated=event(guest,'room-state'); await command(restored,'transfer-host',{roomCode:code,playerId:guestId}); room=await updated;
      assert.equal(room.hostId,guestId);
      assert.equal((await command(restored,'undo-score',{roomCode:code,logId:room.logs[0].id})).ok,false);
      updated=event(guest,'room-state'); await command(guest,'undo-score',{roomCode:code,logId:room.logs[0].id}); room=await updated;
      assert.deepEqual(room.players.map(p=>p.score),[0,0]);
    });
    await t.test('leaving preserves ledger seats and transfers host', async () => {
      updated=event(guest,'room-state'); await command(guest,'transfer-score',{...transfer,fromId:guestId,toId:hostId,requestId:'request-0002'}); room=await updated;
      updated=event(restored,'room-state', r=>r.players.find(p=>p.id===guestId)?.left===true); await command(guest,'leave-room',{roomCode:code}); room=await updated;
      assert.equal(room.hostId,hostId); assert.equal(room.players.find(p=>p.id===guestId).left,true);
      assert.equal(room.players.reduce((sum,p)=>sum+p.score,0),0);
      assert.equal((await command(guest,'transfer-score',{...transfer,requestId:'request-0003'})).ok,false);
    });
    await t.test('seat with ledger can return using token', async () => {
      updated=event(guest,'room-state'); await command(guest,'rejoin-room',{roomCode:code,token:guestSession.token}); room=await updated;
      assert.equal(room.players.find(p=>p.id===guestId).left,false);
      assert.equal(room.players.find(p=>p.id===guestId).score,-5);
    });
    await t.test('passwords, lock, removal and archives are host controlled', async () => {
      assert.equal((await command(guest,'room-settings',{roomCode:code,locked:true,password:''})).ok,false);
      updated=event(restored,'room-state');
      assert.equal((await command(restored,'room-settings',{roomCode:code,locked:false,password:'test-pass'})).ok,true); room=await updated;
      assert.equal(room.hasPassword,true); assert.equal(room.passwordHash,undefined);
      assert.equal((await command(outsider,'join-room',{roomCode:code,playerName:'丙',password:'wrong'})).ok,false);
      updated=event(outsider,'room-state'); assert.equal((await command(outsider,'join-room',{roomCode:code,playerName:'丙',password:'test-pass'})).ok,true); room=await updated;
      const thirdId=room.players.find(p=>p.name==='丙').id;
      assert.equal((await command(guest,'remove-player',{roomCode:code,playerId:thirdId})).ok,false);
      const removed=event(outsider,'room-closed'); updated=event(restored,'room-state');
      assert.equal((await command(restored,'remove-player',{roomCode:code,playerId:thirdId})).ok,true); await removed; room=await updated;
      assert.equal(room.players.some(p=>p.id===thirdId),false);
      updated=event(restored,'room-state'); await command(restored,'room-settings',{roomCode:code,locked:true,password:''}); room=await updated;
      assert.equal((await command(outsider,'join-room',{roomCode:code,playerName:'丙',password:'test-pass'})).ok,false);
      updated=event(restored,'room-state'); await command(restored,'room-settings',{roomCode:code,locked:false,password:''}); await updated;
      updated=event(restored,'room-state'); await command(restored,'remove-password',{roomCode:code}); room=await updated; assert.equal(room.hasPassword,false);
      assert.equal((await command(guest,'next-round',{roomCode:code,round:1})).ok,false);
      updated=event(restored,'room-state'); assert.equal((await command(restored,'next-round',{roomCode:code,round:1})).ok,true); room=await updated;
      assert.equal(room.round,2); assert.equal(room.rounds.length,1); assert.equal(room.rounds[0].logs.length,1);
      assert.equal(room.rounds[0].players.reduce((sum,p)=>sum+p.score,0),0);
      assert.deepEqual(room.players.map(p=>p.score),[0,0]); assert.equal(room.logs.length,0);
      assert.equal((await command(restored,'next-round',{roomCode:code,round:1})).ok,false);
      assert.equal((await command(guest,'claim-host',{roomCode:code})).ok,false);
    });
    await t.test('concurrent scoring keeps both entries and stale undo cannot remove another entry', async () => {
      const a={roomCode:code,fromId:hostId,toId:guestId,amount:2,requestId:'concurrent-0001'};
      const b={roomCode:code,fromId:guestId,toId:hostId,amount:3,requestId:'concurrent-0002'};
      updated=event(restored,'room-state',r=>r.logs.length===2);
      const results=await Promise.all([command(restored,'transfer-score',a),command(guest,'transfer-score',b)]); room=await updated;
      assert.equal(results.every(r=>r.ok),true); assert.equal(room.logs.length,2);
      assert.deepEqual(room.players.map(p=>p.score),[1,-1]);
      assert.equal((await command(restored,'undo-score',{roomCode:code,logId:room.logs[1].id})).ok,false);
      updated=event(restored,'room-state'); await command(restored,'undo-score',{roomCode:code,logId:room.logs[0].id}); room=await updated;
      updated=event(restored,'room-state'); await command(restored,'undo-score',{roomCode:code,logId:room.logs[0].id}); room=await updated;
      assert.deepEqual(room.players.map(p=>p.score),[0,0]);
    });
    await t.test('host takeover requires two minutes offline and changes permissions', async () => {
      updated=event(guest,'room-state'); restored.disconnect(); room=await updated;
      assert.equal((await command(guest,'claim-host',{roomCode:code})).ok,false);
      const stored=JSON.parse(db.prepare('SELECT state_json FROM rooms WHERE code=?').get(code).state_json);
      stored.hostOfflineSince=Date.now()-120001;
      db.prepare('UPDATE rooms SET state_json=? WHERE code=?').run(JSON.stringify(stored),code);
      updated=event(guest,'room-state'); assert.equal((await command(guest,'claim-host',{roomCode:code})).ok,true); room=await updated;
      assert.equal(room.hostId,guestId);
      restored=await connect(); updated=event(restored,'room-state'); await command(restored,'rejoin-room',{roomCode:code,token:hostSession.token}); await updated;
      updated=event(restored,'room-state'); await command(guest,'transfer-host',{roomCode:code,playerId:hostId}); await updated;
    });
    await t.test('room capacity enforced', async () => {
      for(let i=0;i<6;i++) {
        const extra=await connect(); updated=event(extra,'room-state');
        assert.equal((await command(extra,'join-room',{roomCode:code,playerName:'玩家'+i})).ok,true); room=await updated;
      }
      assert.equal(room.players.length,8);
      assert.equal((await command(outsider,'join-room',{roomCode:code,playerName:'满员'})).ok,false);
    });
    await t.test('dissolve closes all sessions and allows a new room', async () => {
      const closed=event(guest,'room-closed'); await command(restored,'reset-room',{roomCode:code}); await closed;
      assert.equal((await command(guest,'rejoin-room',{roomCode:code,token:guestSession.token})).ok,false);
      assert.equal(db.prepare('SELECT count(*) AS total FROM rooms').get().total,0);
      const newRoom=event(guest,'room-created'); assert.equal((await command(guest,'create-room',{hostName:'新房'})).ok,true); await newRoom;
    });
    await t.test('database and backend source cannot be downloaded', async () => {
      assert.equal((await fetch(url+'/data/rooms.db')).status,404);
      assert.equal((await fetch(url+'/server.js')).status,404);
    });
  } finally { sockets.forEach(s=>s.disconnect()); await new Promise(resolve=>io.close(resolve)); db.close(); }
});
