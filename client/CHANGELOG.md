# Client module extraction (Phase A)

## Slice 2 — world keys/constants + WS client glue

- Added `src/world/world-constants.js` — `WORLD_DEFAULT_SIZE`, instancing capacity, interactive / liquid block type sets.
- Added `src/world/world-keys.js` — `worldKey` (`wk`), toroidal `wrapX` / `wrapZ`, `serializeInstancedBlocks` helper for saves.
- Added `src/net/ws-client.js` — `createGameWebSocket`, `dispatchWsMessage`, move throttle + block send helpers (mirrors legacy `connectWS` / `wsSend*`).
- Added `src/net/player-colors.js` — `userColorFromId` for multiplayer HUD.
- Extended `src/net/ws-protocol.js` with `buildMoveMessage` and `WS_RECONNECT_DELAY_MS`.
- Vite scaffold (`main.js`) imports new modules for smoke display only; **`minecraft-chaluton.html` unchanged**.

## Slice 1 — initial scaffold (PR #4)

- `world/block-definitions.js`, `net/api.js`, `net/ws-protocol.js`, `render/bootstrap.js`, Vite config and dev proxy.
