/**
 * WebSocket message types and helpers (multiplayer.js contract).
 * Extracted from minecraft-chaluton.html — connectWS / wsSend*.
 */

export const WS_MESSAGE = {
  JOIN: 'join',
  MOVE: 'move',
  BLOCK_SET: 'blockSet',
  ROOM_STATE: 'roomState',
  PLAYER_JOINED: 'playerJoined',
  PLAYER_MOVED: 'playerMoved',
  PLAYER_LEFT: 'playerLeft',
  ERROR: 'error',
};

/** Minimum interval between move broadcasts (10 Hz). */
export const MOVE_BROADCAST_INTERVAL_MS = 100;

/** Delay before reconnecting after an unexpected close (legacy connectWS). */
export const WS_RECONNECT_DELAY_MS = 3000;

/**
 * @param {{ protocol?: string, host?: string }} loc
 * @returns {string}
 */
export function wsUrl(loc = globalThis.location) {
  const proto = loc.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${loc.host}/ws`;
}

/**
 * Build a join payload (sent on WebSocket open).
 * @param {{ token: string, worldId: string, inviteCode?: string }} params
 */
export function buildJoinMessage({ token, worldId, inviteCode = '' }) {
  return {
    type: WS_MESSAGE.JOIN,
    token,
    worldId,
    inviteCode,
  };
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {string | null} id
 */
export function buildBlockSetMessage(x, y, z, id) {
  return { type: WS_MESSAGE.BLOCK_SET, x, y, z, id: id ?? null };
}

/**
 * @param {{ pos: { x: number, y: number, z: number }, yaw: number, pitch: number }} snapshot
 */
export function buildMoveMessage(snapshot) {
  return {
    type: WS_MESSAGE.MOVE,
    pos: snapshot.pos,
    yaw: snapshot.yaw,
    pitch: snapshot.pitch,
  };
}
