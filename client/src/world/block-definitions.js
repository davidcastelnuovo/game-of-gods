/**
 * Block metadata (names, emoji, face colors).
 * Extracted from minecraft-chaluton.html — BLOCK DEFINITIONS section.
 * Material / InstancedMesh logic remains in legacy HTML until Phase A continues.
 */

/** @type {Record<string, { n: string, e: string, t: number, s: number, b: number, op?: number, em?: number }>} */
export const BLOCK_DEFINITIONS = {
  grass: { n: 'דשא', e: '🌿', t: 0x56c936, s: 0x8b6914, b: 0x6b4510 },
  dirt: { n: 'אדמה', e: '🟫', t: 0x9c7a3c, s: 0x8b6914, b: 0x7a5c2e },
  stone: { n: 'אבן', e: '🪨', t: 0x9e9e9e, s: 0x777777, b: 0x555555 },
  wood: { n: 'עץ', e: '🌲', t: 0xb07030, s: 0x9c6028, b: 0xb07030 },
  leaves: { n: 'עלים', e: '🍃', t: 0x4caf50, s: 0x388e3c, b: 0x2e7d32 },
  sand: { n: 'חול', e: '🏜️', t: 0xffd54f, s: 0xf9a825, b: 0xe65100 },
  water: { n: 'מים', e: '💧', t: 0x00b4d8, s: 0x0096c7, b: 0x023e8a, op: 0.62 },
  gold: { n: 'זהב', e: '⭐', t: 0xffd700, s: 0xffa000, b: 0xff6f00 },
  diamond: { n: 'יהלום', e: '💎', t: 0x00e5ff, s: 0x00bcd4, b: 0x0097a7 },
  lava: { n: 'לבה', e: '🔥', t: 0xff5722, s: 0xbf360c, b: 0x7f0000, em: 0x280000 },
  snow: { n: 'שלג', e: '❄️', t: 0xeceff1, s: 0xcfd8dc, b: 0x90a4ae },
  brick: { n: 'לבנה', e: '🧱', t: 0xef5350, s: 0xc62828, b: 0xb71c1c },
  glass: { n: 'זכוכית', e: '🔷', t: 0xb3e5fc, s: 0x81d4fa, b: 0x4fc3f7, op: 0.4 },
  cloud: { n: 'ענן', e: '☁️', t: 0xffffff, s: 0xe8e8e8, b: 0xcccccc },
  rainbow: { n: 'קשת', e: '🌈', t: 0xff69b4, s: 0x9c27b0, b: 0x3f51b5 },
  TNT: { n: 'TNT', e: '💥', t: 0xf44336, s: 0xc62828, b: 0xf44336 },
  door_wood: { n: 'דלת עץ', e: '🚪', t: 0xa0522d, s: 0x8b4513, b: 0x6b3410 },
  door_iron: { n: 'דלת ברזל', e: '🔩', t: 0xb0bec5, s: 0x78909c, b: 0x546e7a },
  window_glass: { n: 'חלון', e: '🪟', t: 0xb3e5fc, s: 0x81d4fa, b: 0x4fc3f7, op: 0.5 },
  whitewash: { n: 'טיח לבן', e: '🤍', t: 0xf5f0e8, s: 0xddd8cc, b: 0xc8c2b5 },
  blue_dome: { n: 'כיפה כחולה', e: '💙', t: 0x1a6bb5, s: 0x0d4f8b, b: 0x083a6b },
  cobble_aegean: { n: 'אבן אגאית', e: '🪨', t: 0x8a9bae, s: 0x6b7a8d, b: 0x4f5e6e },
  terracotta: { n: 'חרס', e: '🟤', t: 0xc4714a, s: 0xa85a35, b: 0x8b4420 },
  sea_shallow: { n: 'ים רדוד', e: '🩵', t: 0x48cae4, s: 0x00b4d8, b: 0x0096c7, op: 0.58 },
  sea_deep: { n: 'ים עמוק', e: '🔵', t: 0x023e8a, s: 0x03045e, b: 0x020030, op: 0.8 },
  bougainvillea: { n: 'בוגנוויליה', e: '🌸', t: 0xff006e, s: 0xc9184a, b: 0x85002b },
  marble: { n: 'שיש', e: '⬜', t: 0xe8e0d5, s: 0xcfc4b5, b: 0xb5a898 },
  volcanic: { n: 'בזלת', e: '⚫', t: 0x3d3535, s: 0x2a2222, b: 0x1a1212 },
  blue_door: { n: 'דלת כחולה', e: '🚪', t: 0x1a6bb5, s: 0x0d4f8b, b: 0x083a6b },
  blue_window: { n: 'חלון כחול', e: '🪟', t: 0x48cae4, s: 0x00b4d8, b: 0x0096c7, op: 0.55 },
};

/** Toolbar / palette order in the legacy client. */
export const BLOCK_PALETTE = [
  'grass', 'dirt', 'stone', 'wood', 'leaves', 'sand', 'water',
  'gold', 'diamond', 'lava', 'snow', 'brick', 'glass', 'cloud', 'rainbow', 'TNT',
  'whitewash', 'blue_dome', 'cobble_aegean', 'terracotta', 'marble', 'volcanic',
  'bougainvillea', 'sea_shallow', 'sea_deep', 'blue_door', 'blue_window',
];

/** Legacy global alias used throughout the monolith (for gradual migration). */
export const BD = BLOCK_DEFINITIONS;
export const PALETTE = BLOCK_PALETTE;
