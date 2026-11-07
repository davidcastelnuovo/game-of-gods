/**
 * Vite entry — validates extracted modules (Phase A scaffold).
 * Full game: http://localhost:3000/ (minecraft-chaluton.html via Express).
 */

import { BLOCK_DEFINITIONS, BLOCK_PALETTE } from './world/block-definitions.js';
import {
  WORLD_DEFAULT_SIZE,
  INTERACTIVE_BLOCK_TYPES,
  INSTANCED_MESH_INITIAL_CAPACITY,
} from './world/world-constants.js';
import { worldKey, wrapX } from './world/world-keys.js';
import { api, setApiToken } from './net/api.js';
import { WS_MESSAGE, wsUrl, WS_RECONNECT_DELAY_MS } from './net/ws-protocol.js';
import { createGameWebSocket, dispatchWsMessage } from './net/ws-client.js';
import { userColorFromId } from './net/player-colors.js';
import { createRenderer } from './render/bootstrap.js';

const status = document.getElementById('status');
if (status) {
  const blockCount = Object.keys(BLOCK_DEFINITIONS).length;
  const sampleKey = worldKey(1, 2, 3);
  const sampleWrap = wrapX(-1, WORLD_DEFAULT_SIZE);
  const sampleColor = userColorFromId('00000000-0000-0000-0000-000000000001');
  const wsFactory = typeof createGameWebSocket === 'function';
  const wsDispatch = typeof dispatchWsMessage === 'function';

  status.innerHTML = [
    `מודולים נטענו: <strong>${blockCount}</strong> הגדרות בלוק, `,
    `<strong>${BLOCK_PALETTE.length}</strong> פריטים בפלטה.<br>`,
    `עולם: גודל ברירת מחדל <strong>${WORLD_DEFAULT_SIZE}</strong>, instancing capacity `,
    `<strong>${INSTANCED_MESH_INITIAL_CAPACITY}</strong>, אינטראקטיביים `,
    `<strong>${INTERACTIVE_BLOCK_TYPES.size}</strong> סוגים.<br>`,
    `מפתח דוגמה <code>${sampleKey}</code> · wrapX(-1)=<code>${sampleWrap}</code> · צבע שחקן `,
    `<code>${sampleColor}</code><br>`,
    `REST: <code>api()</code> מוכן · WS: <code>${wsUrl()}</code> · reconnect `,
    `<strong>${WS_RECONNECT_DELAY_MS}</strong>ms · client: `,
    wsFactory && wsDispatch ? 'createGameWebSocket OK' : '—',
    ` · הודעות: ${Object.values(WS_MESSAGE).join(', ')}`,
    `<br>Renderer bootstrap: WebGL ${createRenderer(1, 1).domElement ? 'OK' : '—'}`,
    `<br><br>להרצת המשחק: <a href="http://localhost:3000/">http://localhost:3000/</a> (דורש <code>node server</code>).`,
  ].join('');
}

export {
  BLOCK_DEFINITIONS,
  BLOCK_PALETTE,
  WORLD_DEFAULT_SIZE,
  worldKey,
  api,
  setApiToken,
  WS_MESSAGE,
  wsUrl,
  createGameWebSocket,
  userColorFromId,
  createRenderer,
};
