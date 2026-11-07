/**
 * Sparse world map keys and toroidal wrap helpers.
 * Legacy: `wk`, `wrapX`, `wrapZ` in minecraft-chaluton.html.
 */

/**
 * Canonical key for world / interactWorld Maps.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
export function worldKey(x, y, z) {
  return `${x | 0}|${y | 0}|${z | 0}`;
}

/** @deprecated Alias matching legacy `wk`. */
export const wk = worldKey;

/**
 * Toroidal X for block lookup — result in [0, worldSize).
 * @param {number} x
 * @param {number} worldSize
 */
export function wrapX(x, worldSize) {
  const w = worldSize;
  return ((Math.round(x) % w) + w) % w;
}

/**
 * Toroidal Z for block lookup — result in [0, worldSize).
 * @param {number} z
 * @param {number} worldSize
 */
export function wrapZ(z, worldSize) {
  const w = worldSize;
  return ((Math.round(z) % w) + w) % w;
}

/**
 * Serialize instanced world entries for REST save payloads.
 * @param {Iterable<{ x: number, y: number, z: number, id: string }>} entries
 * @returns {{ x: number, y: number, z: number, id: string }[]}
 */
export function serializeInstancedBlocks(entries) {
  const blocks = [];
  for (const info of entries) {
    blocks.push({ x: info.x, y: info.y, z: info.z, id: info.id });
  }
  return blocks;
}
