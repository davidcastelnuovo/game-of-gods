/**
 * Vite entry — validates extracted modules (Phase A scaffold).
 * Full game: http://localhost:3000/ (minecraft-chaluton.html via Express).
 */

import { BLOCK_DEFINITIONS, BLOCK_PALETTE } from './world/block-definitions.js';
import { api, setApiToken } from './net/api.js';
import { WS_MESSAGE, wsUrl } from './net/ws-protocol.js';
import { createRenderer } from './render/bootstrap.js';

const status = document.getElementById('status');
if (status) {
  const blockCount = Object.keys(BLOCK_DEFINITIONS).length;
  status.innerHTML = [
    `מודולים נטענו: <strong>${blockCount}</strong> הגדרות בלוק, `,
    `<strong>${BLOCK_PALETTE.length}</strong> פריטים בפלטה.<br>`,
    `REST: <code>api()</code> מוכן · WS: <code>${wsUrl()}</code> · הודעות: `,
    Object.values(WS_MESSAGE).join(', '),
    `<br>Renderer bootstrap: WebGL ${createRenderer(1, 1).domElement ? 'OK' : '—'}`,
    `<br><br>להרצת המשחק: <a href="http://localhost:3000/">http://localhost:3000/</a> (דורש <code>node server</code>).`,
  ].join('');
}

export {
  BLOCK_DEFINITIONS,
  BLOCK_PALETTE,
  api,
  setApiToken,
  WS_MESSAGE,
  wsUrl,
  createRenderer,
};
