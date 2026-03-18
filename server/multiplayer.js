const { WebSocketServer } = require('ws');
const { sessions }        = require('./auth');
const { loadWorld }       = require('./worlds');

const wss   = new WebSocketServer({ noServer: true });
const rooms = new Map(); // worldId → Set<clientInfo>

// ── Colour from userId (deterministic) ────────────────────
function userColor(userId) {
  const h = parseInt(userId.replace(/-/g, '').slice(0, 6), 16) % 360;
  return `hsl(${h},70%,65%)`;
}

// ── Broadcast to all room members except `exclude` ────────
function broadcast(room, exclude, msg) {
  if (!room) return;
  const str = JSON.stringify(msg);
  for (const c of room) {
    if (c !== exclude && c.ws.readyState === 1 /* OPEN */) {
      c.ws.send(str);
    }
  }
}

// ── HTTP upgrade handler (called by server.js) ────────────
function handleUpgrade(req, socket, head) {
  if (req.url === '/ws') {
    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
}

// ── Connection handler ────────────────────────────────────
wss.on('connection', ws => {
  let client = null; // set on successful 'join'

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // ── join ──────────────────────────────────────────────
    if (msg.type === 'join') {
      const session = sessions.get(msg.token);
      if (!session) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
        return;
      }
      const world = loadWorld(msg.worldId);
      if (!world) {
        ws.send(JSON.stringify({ type: 'error', message: 'World not found' }));
        return;
      }
      const isOwner   = world.ownerId === session.userId;
      const inviteOK  = msg.inviteCode && msg.inviteCode.toUpperCase() === world.inviteCode;
      if (!isOwner && !inviteOK) {
        ws.send(JSON.stringify({ type: 'error', message: 'Access denied' }));
        return;
      }

      // Check if this user is already in the room (reconnect) — remove old entry
      const existingRoom = rooms.get(msg.worldId);
      if (existingRoom) {
        for (const c of existingRoom) {
          if (c.playerId === session.userId) {
            existingRoom.delete(c);
            break;
          }
        }
      }

      client = {
        ws,
        playerId:  session.userId,
        username:  session.username,
        color:     userColor(session.userId),
        worldId:   msg.worldId,
        pos:       { x: Math.floor(world.size / 2), y: 10, z: Math.floor(world.size / 2) },
        yaw:       0,
        pitch:     0,
      };

      if (!rooms.has(msg.worldId)) rooms.set(msg.worldId, new Set());
      const room = rooms.get(msg.worldId);
      room.add(client);

      // Send current room state to the new joiner
      const others = [...room]
        .filter(c => c !== client)
        .map(c => ({ playerId: c.playerId, username: c.username, color: c.color, pos: c.pos, yaw: c.yaw }));
      ws.send(JSON.stringify({ type: 'roomState', players: others }));

      // Notify everyone else
      broadcast(room, client, {
        type: 'playerJoined',
        playerId: client.playerId,
        username:  client.username,
        color:     client.color,
        pos:       client.pos,
        yaw:       client.yaw,
      });

      console.log(`[WS] ${client.username} joined world ${msg.worldId} (${room.size} players)`);
      return;
    }

    if (!client) return; // all other messages require a joined client

    // ── move ──────────────────────────────────────────────
    if (msg.type === 'move') {
      client.pos   = msg.pos;
      client.yaw   = msg.yaw;
      client.pitch = msg.pitch;
      broadcast(rooms.get(client.worldId), client, {
        type:     'playerMoved',
        playerId: client.playerId,
        pos:      msg.pos,
        yaw:      msg.yaw,
        pitch:    msg.pitch,
      });
      return;
    }

    // ── blockSet ──────────────────────────────────────────
    if (msg.type === 'blockSet') {
      broadcast(rooms.get(client.worldId), client, {
        type:     'blockSet',
        playerId: client.playerId,
        x: msg.x, y: msg.y, z: msg.z,
        id:       msg.id ?? null,
      });
      return;
    }
  });

  ws.on('close', () => {
    if (!client) return;
    const room = rooms.get(client.worldId);
    if (room) {
      room.delete(client);
      broadcast(room, null, { type: 'playerLeft', playerId: client.playerId, username: client.username });
      console.log(`[WS] ${client.username} left world ${client.worldId} (${room.size} remaining)`);
      if (room.size === 0) rooms.delete(client.worldId);
    }
  });

  ws.on('error', err => console.error('[WS] error:', err.message));
});

module.exports = { handleUpgrade };
