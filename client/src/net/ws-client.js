/**
 * Browser WebSocket multiplayer client (connectWS / wsSend* logic).
 * Extracted from minecraft-chaluton.html — injected deps keep legacy HTML unchanged.
 */

import {
  WS_MESSAGE,
  wsUrl,
  buildJoinMessage,
  buildBlockSetMessage,
  buildMoveMessage,
  MOVE_BROADCAST_INTERVAL_MS,
  WS_RECONNECT_DELAY_MS,
} from './ws-protocol.js';

export { WS_RECONNECT_DELAY_MS, MOVE_BROADCAST_INTERVAL_MS };

/**
 * @typedef {object} WsClientHandlers
 * @property {(msg: { players: unknown[] }) => void} [onRoomState]
 * @property {(msg: Record<string, unknown>) => void} [onPlayerJoined]
 * @property {(msg: Record<string, unknown>) => void} [onPlayerMoved]
 * @property {(msg: { playerId: string, username?: string }) => void} [onPlayerLeft]
 * @property {(msg: { x: number, y: number, z: number, id: string | null }) => void} [onBlockSet]
 * @property {(msg: { message?: string }) => void} [onError]
 */

/**
 * Route one parsed server message (same switch as legacy ws.onmessage).
 * @param {Record<string, unknown>} msg
 * @param {WsClientHandlers} handlers
 */
export function dispatchWsMessage(msg, handlers) {
  switch (msg.type) {
    case WS_MESSAGE.ROOM_STATE:
      handlers.onRoomState?.(/** @type {{ players: unknown[] }} */ (msg));
      break;
    case WS_MESSAGE.PLAYER_JOINED:
      handlers.onPlayerJoined?.(msg);
      break;
    case WS_MESSAGE.PLAYER_MOVED:
      handlers.onPlayerMoved?.(msg);
      break;
    case WS_MESSAGE.PLAYER_LEFT:
      handlers.onPlayerLeft?.(/** @type {{ playerId: string, username?: string }} */ (msg));
      break;
    case WS_MESSAGE.BLOCK_SET:
      handlers.onBlockSet?.(/** @type {{ x: number, y: number, z: number, id: string | null }} */ (msg));
      break;
    case WS_MESSAGE.ERROR:
      handlers.onError?.(/** @type {{ message?: string }} */ (msg));
      break;
    default:
      break;
  }
}

/**
 * @param {number} now
 * @param {number} lastBroadcastMs
 */
export function shouldThrottleMove(now, lastBroadcastMs) {
  return now - lastBroadcastMs < MOVE_BROADCAST_INTERVAL_MS;
}

/**
 * Legacy-style move sender with 10 Hz throttle.
 * @param {WebSocket} ws
 * @param {{ pos: { x: number, y: number, z: number }, yaw: number, pitch: number }} snapshot
 * @param {number} lastBroadcastMs
 * @returns {number} updated lastBroadcastMs
 */
export function trySendMove(ws, snapshot, lastBroadcastMs) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return lastBroadcastMs;
  const now = Date.now();
  if (shouldThrottleMove(now, lastBroadcastMs)) return lastBroadcastMs;
  ws.send(JSON.stringify(buildMoveMessage(snapshot)));
  return now;
}

/**
 * @param {WebSocket} ws
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {string | null} id
 * @param {{ skipEcho?: boolean }} [opts]
 */
export function sendBlockSet(ws, x, y, z, id, opts = {}) {
  if (opts.skipEcho) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(buildBlockSetMessage(x, y, z, id)));
}

/**
 * Create and manage the game WebSocket (reconnect on close when shouldReconnect).
 *
 * @param {{
 *   worldId: string,
 *   inviteCode?: string,
 *   getToken: () => string | null,
 *   handlers: WsClientHandlers,
 *   shouldReconnect?: () => boolean,
 *   location?: { protocol?: string, host?: string },
 *   WebSocketCtor?: typeof WebSocket,
 *   reconnectDelayMs?: number,
 * }} options
 * @returns {{ connect: () => WebSocket, getSocket: () => WebSocket | null, close: () => void }}
 */
export function createGameWebSocket(options) {
  const {
    worldId,
    inviteCode = '',
    getToken,
    handlers,
    shouldReconnect = () => true,
    location = globalThis.location,
    WebSocketCtor = globalThis.WebSocket,
    reconnectDelayMs = WS_RECONNECT_DELAY_MS,
  } = options;

  /** @type {WebSocket | null} */
  let socket = null;
  let reconnectTimer = null;

  function clearReconnect() {
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function connect() {
    clearReconnect();
    if (socket) {
      try {
        socket.close();
      } catch {
        /* ignore */
      }
    }

    const ws = new WebSocketCtor(wsUrl(location));
    socket = ws;

    ws.addEventListener('open', () => {
      const token = getToken();
      if (!token) {
        handlers.onError?.({ message: 'Missing auth token for WS join' });
        return;
      }
      ws.send(JSON.stringify(buildJoinMessage({ token, worldId, inviteCode })));
    });

    ws.addEventListener('message', (evt) => {
      let msg;
      try {
        msg = JSON.parse(String(evt.data));
      } catch {
        return;
      }
      dispatchWsMessage(msg, handlers);
    });

    ws.addEventListener('close', () => {
      if (!shouldReconnect()) return;
      reconnectTimer = setTimeout(() => connect(), reconnectDelayMs);
    });

    ws.addEventListener('error', () => {
      handlers.onError?.({ message: 'WebSocket error' });
    });

    return ws;
  }

  function close() {
    clearReconnect();
    if (socket) {
      try {
        socket.close();
      } catch {
        /* ignore */
      }
      socket = null;
    }
  }

  return {
    connect,
    getSocket: () => socket,
    close,
  };
}
