const express    = require('express');
const crypto     = require('crypto');
const fs         = require('fs');
const path       = require('path');
const { requireAuth } = require('./auth');

const router      = express.Router();
const WORLDS_DIR  = path.join(__dirname, 'data', 'worlds');

// Ensure directory exists
if (!fs.existsSync(WORLDS_DIR)) fs.mkdirSync(WORLDS_DIR, { recursive: true });

// ── Helpers ────────────────────────────────────────────────
function worldFile(id) { return path.join(WORLDS_DIR, `${id}.json`); }

function loadWorld(id) {
  const f = worldFile(id);
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch { return null; }
}

function saveWorld(w) {
  w.updatedAt = new Date().toISOString();
  fs.writeFileSync(worldFile(w.id), JSON.stringify(w));
}

function randomCode(len = 6) {
  return crypto.randomBytes(len).toString('base64url').slice(0, len).toUpperCase();
}

// ── Terrain Generation ─────────────────────────────────────
// Deterministic height using layered sin/cos (mirrors client logic)
function H(x, z, amp, freq) {
  return Math.round(
    (Math.sin(x * freq)      * amp +
     Math.cos(z * freq)      * amp +
     Math.sin((x+z) * freq * 0.7) * amp * 0.5 +
     Math.cos((x-z) * freq * 0.5) * amp * 0.3) / 2
  );
}

// Simple deterministic noise: returns 0..1
function noise(x, z, seed = 1) {
  const n = Math.sin(x * 127.1 * seed + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// ── Cyclades world generator ─────────────────────────────────
// Builds a sea-level world (stone floor + water) with multiple Cyclades-style
// Greek islands scattered across it. Each island has: sandy beach ring, green
// interior, rocky peak, white-walled village with blue windows, windmill,
// well, small marina + fishing boats. Deterministic — given the same sz the
// layout is identical every time.
const CY_SEA_LEVEL = 6;   // water top
const CY_SEABED    = 0;   // ocean floor

// ── Seeded RNG ───────────────────────────────────────────────
function cyRng(seed) {
  let s = (seed | 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

// ── Island heightfield — sums contributions from all islands ──
function cyBuildHeights(sz, islands) {
  const H = new Int8Array(sz * sz);
  for (const isl of islands) {
    const r = isl.radius + 4;
    const minX = Math.max(0, Math.floor(isl.cx - r));
    const maxX = Math.min(sz - 1, Math.ceil(isl.cx + r));
    const minZ = Math.max(0, Math.floor(isl.cz - r));
    const maxZ = Math.min(sz - 1, Math.ceil(isl.cz + r));
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        const dx = x - isl.cx;
        const dz = z - isl.cz;
        const d  = Math.sqrt(dx * dx + dz * dz);
        // Organic, lobed shoreline — varies with angle + island seed
        const a  = Math.atan2(dz, dx);
        const shoreWobble =
          Math.sin(a * 3 + isl.seed)     * 2.2 +
          Math.cos(a * 5 + isl.seed * 2) * 1.4 +
          Math.sin(a * 2.3 + isl.seed * 3) * 1.0;
        const effR = isl.radius + shoreWobble;
        if (d > effR) continue;
        const t = 1 - d / effR;                    // 0 at shore, 1 at center
        // Smooth hump plus a sharper peak near the middle
        const hump = t * t;
        const peak = Math.pow(Math.max(0, t - 0.35), 2) * 2.2;
        const h    = Math.round(CY_SEA_LEVEL + (hump + peak) * (isl.height - CY_SEA_LEVEL));
        const idx  = x * sz + z;
        if (h > H[idx]) H[idx] = h;
      }
    }
  }
  return H;
}

// ── Cyclades village: cluster of 4-8 small white houses ──
// White walls use the 'cloud' block (pure white), blue windows use
// 'window_glass'. Roofs are flat (also cloud) — authentic Cycladic style.
function cyAddVillage(blocks, H, sz, isl, rng) {
  const add = (x, y, z, id) => blocks.push({ x, y, z, id });
  const idxOf = (x, z) => x * sz + z;
  const placed = [];
  const numHouses = 5 + Math.floor(rng() * 4);
  let attempts = 0;
  while (placed.length < numHouses && attempts++ < 800) {
    // Sample points across the whole island interior
    const ang = rng() * Math.PI * 2;
    const r   = isl.radius * (0.15 + rng() * 0.65);
    const hx  = Math.round(isl.cx + Math.cos(ang) * r);
    const hz  = Math.round(isl.cz + Math.sin(ang) * r);
    if (hx < 2 || hz < 2 || hx + 6 >= sz || hz + 6 >= sz) continue;
    // Ensure a small flat-ish 4×4 footprint sitting above sea level
    let minH = 99, maxH = 0;
    for (let dx = 0; dx < 4; dx++) for (let dz = 0; dz < 4; dz++) {
      const h = H[idxOf(hx + dx, hz + dz)];
      if (h === 0) { minH = 0; break; }   // don't build in the ocean
      if (h < minH) minH = h;
      if (h > maxH) maxH = h;
    }
    if (minH <= CY_SEA_LEVEL || maxH - minH > 2 || minH > CY_SEA_LEVEL + 10) continue;
    // AND-check so two houses can still fit in different quadrants
    if (placed.some(p => Math.abs(p[0] - hx) < 5 && Math.abs(p[1] - hz) < 5)) continue;
    placed.push([hx, hz, minH]);

    // ── Small Cycladic house: 4×4 footprint, 3 tall, flat white roof ──
    const baseY = minH + 1;
    for (let bx = 0; bx < 4; bx++) for (let bz = 0; bz < 4; bz++) {
      // Walls
      for (let h = 0; h < 3; h++) {
        const isWall = bx === 0 || bx === 3 || bz === 0 || bz === 3;
        if (isWall) add(hx + bx, baseY + h, hz + bz, 'cloud');
      }
      // Flat roof
      add(hx + bx, baseY + 3, hz + bz, 'cloud');
    }
    // Blue window punched into the front (one window per wall, centered)
    add(hx + 1, baseY + 1, hz + 0, 'window_glass');
    add(hx + 1, baseY + 1, hz + 3, 'window_glass');
    add(hx + 0, baseY + 1, hz + 2, 'window_glass');
    add(hx + 3, baseY + 1, hz + 2, 'window_glass');
    // Door — facing the ocean side (choose the wall nearest to island center)
    const dirX = hx < isl.cx ? 3 : 0;  // door on the side facing away from center
    const dirZ = hz < isl.cz ? 3 : 0;
    // Prefer whichever dimension is further from center
    if (Math.abs(hx - isl.cx) > Math.abs(hz - isl.cz)) {
      add(hx + dirX, baseY,     hz + 2, 'door_wood');
      add(hx + dirX, baseY + 1, hz + 2, 'door_wood');
    } else {
      add(hx + 2, baseY,     hz + dirZ, 'door_wood');
      add(hx + 2, baseY + 1, hz + dirZ, 'door_wood');
    }
  }
  return placed;
}

// ── Windmill: small stone tower topped with a wooden cross ──
function cyAddWindmill(blocks, H, sz, isl, rng) {
  const add = (x, y, z, id) => blocks.push({ x, y, z, id });
  // Place on a high-ish spot near the village ring (not on the peak)
  const ang = rng() * Math.PI * 2;
  const r   = isl.radius * 0.55;
  const wx  = Math.round(isl.cx + Math.cos(ang) * r);
  const wz  = Math.round(isl.cz + Math.sin(ang) * r);
  if (wx < 1 || wz < 1 || wx + 2 >= sz || wz + 2 >= sz) return;
  const baseH = H[wx * sz + wz];
  if (baseH < CY_SEA_LEVEL + 2) return;

  // ── Round-ish 3×3 stone tower, 5 blocks tall ──
  for (let h = 1; h <= 5; h++) {
    add(wx, baseH + h, wz, 'cloud');
    add(wx + 1, baseH + h, wz, 'cloud');
    add(wx - 1, baseH + h, wz, 'cloud');
    add(wx, baseH + h, wz + 1, 'cloud');
    add(wx, baseH + h, wz - 1, 'cloud');
  }
  // Wooden top cap
  add(wx, baseH + 6, wz, 'wood');
  add(wx + 1, baseH + 6, wz, 'wood');
  add(wx - 1, baseH + 6, wz, 'wood');
  add(wx, baseH + 6, wz + 1, 'wood');
  add(wx, baseH + 6, wz - 1, 'wood');
  // Cross arms (sails) — 4 directions, 3 long each, leaves
  for (let i = 1; i <= 3; i++) {
    add(wx + i, baseH + 7, wz,     'leaves');
    add(wx - i, baseH + 7, wz,     'leaves');
    add(wx,     baseH + 7, wz + i, 'leaves');
    add(wx,     baseH + 7, wz - i, 'leaves');
  }
  add(wx, baseH + 7, wz, 'wood'); // hub
}

// ── Well: round stone ring with water inside + 2 wooden posts ──
function cyAddWell(blocks, H, sz, isl, rng) {
  const add = (x, y, z, id) => blocks.push({ x, y, z, id });
  const ang = rng() * Math.PI * 2;
  const r   = isl.radius * 0.4;
  const wx  = Math.round(isl.cx + Math.cos(ang) * r);
  const wz  = Math.round(isl.cz + Math.sin(ang) * r);
  if (wx < 2 || wz < 2 || wx + 2 >= sz || wz + 2 >= sz) return;
  const baseH = H[wx * sz + wz];
  if (baseH < CY_SEA_LEVEL + 2) return;
  // Stone ring 3×3 with water in the middle
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const isCenter = dx === 0 && dz === 0;
    add(wx + dx, baseH + 1, wz + dz, isCenter ? 'water' : 'stone');
  }
  // Two wooden posts + crossbeam
  add(wx - 1, baseH + 2, wz, 'wood');
  add(wx + 1, baseH + 2, wz, 'wood');
  add(wx - 1, baseH + 3, wz, 'wood');
  add(wx + 1, baseH + 3, wz, 'wood');
  add(wx,     baseH + 3, wz, 'wood'); // crossbeam
}

// ── Marina: wooden pier extending from beach into the sea, with a boat ──
function cyAddMarina(blocks, H, sz, isl, rng) {
  const add = (x, y, z, id) => blocks.push({ x, y, z, id });
  const idxOf = (x, z) => x * sz + z;
  // Find a beach point (height == CY_SEA_LEVEL+1) closest to the shore in a random direction
  const ang = rng() * Math.PI * 2;
  let px = -1, pz = -1;
  for (let step = 0; step <= isl.radius + 4; step++) {
    const tx = Math.round(isl.cx + Math.cos(ang) * step);
    const tz = Math.round(isl.cz + Math.sin(ang) * step);
    if (tx < 0 || tz < 0 || tx >= sz || tz >= sz) break;
    if (H[idxOf(tx, tz)] === 0) {
      // Just stepped into the ocean — previous step was the beach
      px = Math.round(isl.cx + Math.cos(ang) * (step - 1));
      pz = Math.round(isl.cz + Math.sin(ang) * (step - 1));
      break;
    }
  }
  if (px < 0) return;

  // Pier: 5 blocks of wood extending into the sea from the beach
  const dirX = Math.sign(Math.cos(ang)) || 1;
  const dirZ = Math.sign(Math.sin(ang)) || 1;
  for (let i = 1; i <= 6; i++) {
    const tx = px + dirX * i;
    const tz = pz + dirZ * i;
    if (tx < 0 || tz < 0 || tx >= sz || tz >= sz) break;
    if (H[idxOf(tx, tz)] !== 0) break; // hit another island
    add(tx, CY_SEA_LEVEL,     tz, 'wood');
    add(tx, CY_SEA_LEVEL + 1, tz, 'wood');
  }
  // Small fishing boat at the end of the pier
  const ex = px + dirX * 7;
  const ez = pz + dirZ * 7;
  if (ex >= 0 && ez >= 0 && ex < sz && ez < sz && H[idxOf(ex, ez)] === 0) {
    cyAddBoat(blocks, ex, ez, 'small');
  }
  // Bigger ship further out
  const bx = px + dirX * 10;
  const bz = pz + dirZ * 10;
  if (bx >= 0 && bz >= 0 && bx < sz && bz < sz && H[idxOf(bx, bz)] === 0) {
    cyAddBoat(blocks, bx, bz, 'large');
  }
}

// ── Boat — wood hull + sail on a mast ──
function cyAddBoat(blocks, x, z, size) {
  const add = (wx, wy, wz, id) => blocks.push({ x: wx, y: wy, z: wz, id });
  const y = CY_SEA_LEVEL;
  if (size === 'small') {
    // 3×2 hull at water level
    for (let dx = 0; dx < 3; dx++) for (let dz = 0; dz < 2; dz++) add(x + dx, y, z + dz, 'wood');
    // Mast + sail
    add(x + 1, y + 1, z, 'wood');
    add(x + 1, y + 2, z, 'wood');
    add(x + 1, y + 3, z, 'cloud'); // sail
  } else {
    // 4×3 hull + taller mast + bigger sail
    for (let dx = 0; dx < 4; dx++) for (let dz = 0; dz < 3; dz++) add(x + dx, y, z + dz, 'wood');
    add(x + 1, y + 1, z + 1, 'wood');
    add(x + 1, y + 2, z + 1, 'wood');
    add(x + 1, y + 3, z + 1, 'wood');
    add(x + 2, y + 1, z + 1, 'wood');
    // Big triangular-ish sail made of cloud blocks
    add(x + 1, y + 3, z,     'cloud');
    add(x + 1, y + 3, z + 2, 'cloud');
    add(x + 2, y + 3, z + 1, 'cloud');
    add(x + 1, y + 4, z + 1, 'cloud');
  }
}

// ── Wandering fishing boats scattered in the sea near an island ──
function cyAddFishingBoats(blocks, H, sz, isl, rng, count) {
  const idxOf = (x, z) => x * sz + z;
  for (let i = 0; i < count; i++) {
    const ang = rng() * Math.PI * 2;
    const dist = isl.radius + 4 + rng() * 6;
    const bx = Math.round(isl.cx + Math.cos(ang) * dist);
    const bz = Math.round(isl.cz + Math.sin(ang) * dist);
    if (bx < 0 || bz < 0 || bx + 3 >= sz || bz + 3 >= sz) continue;
    if (H[idxOf(bx, bz)] !== 0) continue; // must be in water
    cyAddBoat(blocks, bx, bz, rng() > 0.6 ? 'large' : 'small');
  }
}

// ── Mountain stream: trace water from the island peak down to the shore ──
function cyAddStream(blocks, H, sz, isl, rng) {
  const add = (x, y, z, id) => blocks.push({ x, y, z, id });
  const idxOf = (x, z) => x * sz + z;
  // Start from the highest point within the island's bounds
  let px = Math.round(isl.cx), pz = Math.round(isl.cz);
  let peakH = H[idxOf(px, pz)];
  for (let x = Math.max(0, Math.round(isl.cx - isl.radius)); x < Math.min(sz, Math.round(isl.cx + isl.radius)); x++) {
    for (let z = Math.max(0, Math.round(isl.cz - isl.radius)); z < Math.min(sz, Math.round(isl.cz + isl.radius)); z++) {
      if (H[idxOf(x, z)] > peakH) { peakH = H[idxOf(x, z)]; px = x; pz = z; }
    }
  }
  if (peakH < CY_SEA_LEVEL + 3) return;
  // Walk downhill — at each step, pick the neighbor with the lowest height
  const visited = new Set();
  for (let step = 0; step < 60; step++) {
    const key = px + '|' + pz;
    if (visited.has(key)) break;
    visited.add(key);
    const h = H[idxOf(px, pz)];
    if (h <= CY_SEA_LEVEL) break;
    // Place a water block at the top of this column (carve a groove)
    add(px, h, pz, 'water');
    // Find lowest neighbour that's still on the island
    let best = null, bestH = h;
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const [dx, dz] of dirs) {
      const nx = px + dx, nz = pz + dz;
      if (nx < 0 || nz < 0 || nx >= sz || nz >= sz) continue;
      const nh = H[idxOf(nx, nz)];
      if (nh > 0 && nh < bestH) { bestH = nh; best = [nx, nz]; }
    }
    if (!best) break;
    px = best[0]; pz = best[1];
  }
}

function generateCyclades(sz) {
  const blocks = [];
  const add = (x, y, z, id) => blocks.push({ x, y, z, id });

  const rng = cyRng(12345); // deterministic master seed

  // ── Scatter islands of varied size across the world ──
  const islands = [];
  const clusters = [
    { cx: 0.25, cz: 0.28, radius: 22, height: 22, seed: 11 }, // big NW
    { cx: 0.72, cz: 0.25, radius: 15, height: 14, seed: 23 }, // mid NE
    { cx: 0.18, cz: 0.72, radius: 13, height: 11, seed: 37 }, // small SW
    { cx: 0.55, cz: 0.50, radius: 19, height: 18, seed: 47 }, // center
    { cx: 0.85, cz: 0.60, radius: 11, height: 10, seed: 53 }, // small E
    { cx: 0.40, cz: 0.85, radius: 17, height: 16, seed: 67 }, // S
  ];
  for (const c of clusters) {
    islands.push({
      cx:     c.cx * sz,
      cz:     c.cz * sz,
      radius: c.radius,
      height: c.height,
      seed:   c.seed,
    });
  }

  const H = cyBuildHeights(sz, islands);

  // ── Emit the world column by column ──
  for (let x = 0; x < sz; x++) {
    for (let z = 0; z < sz; z++) {
      const h = H[x * sz + z];
      if (h === 0) {
        // ── Ocean column ──
        add(x, CY_SEABED, z, 'stone');
        for (let y = 1; y <= CY_SEA_LEVEL; y++) add(x, y, z, 'water');
      } else {
        // ── Island column ──
        // Surface material by height
        let surface;
        if (h <= CY_SEA_LEVEL + 2)      surface = 'sand';   // beach
        else if (h <= CY_SEA_LEVEL + 7) surface = 'grass';  // mid
        else if (h >= 18)               surface = 'stone';  // rocky peak
        else                             surface = 'grass';
        // Stone fill from seabed up
        for (let y = 0; y < h - 1; y++) add(x, y, z, 'stone');
        // Dirt under grass, else just fill stone
        if (surface === 'grass') add(x, h - 1, z, 'dirt');
        add(x, h, z, surface);
      }
    }
  }

  // ── Per-island features ──
  for (const isl of islands) {
    const rIsl = cyRng(isl.seed * 31);
    cyAddStream(blocks, H, sz, isl, rIsl);
    cyAddVillage(blocks, H, sz, isl, rIsl);
    cyAddWindmill(blocks, H, sz, isl, rIsl);
    cyAddWell(blocks, H, sz, isl, rIsl);
    cyAddMarina(blocks, H, sz, isl, rIsl);
    cyAddFishingBoats(blocks, H, sz, isl, rIsl, 3);
  }

  return blocks;
}

function generateTerrain(type, sz) {
  const blocks = [];
  const add = (x, y, z, id) => blocks.push({ x, y, z, id });

  if (type === 'cyclades') {
    return generateCyclades(sz);
  }

  if (type === 'flat') {
    // ── FLAT WORLD ──────────────────────────────────────────
    for (let x = 0; x < sz; x++) {
      for (let z = 0; z < sz; z++) {
        add(x, 0, z, 'grass');
        add(x, -1, z, 'dirt');
        add(x, -2, z, 'dirt');
        add(x, -3, z, 'stone');
        add(x, -4, z, 'stone');
      }
    }

  } else if (type === 'block') {
    // ── BLOCK WORLD — classic rolling hills ─────────────────
    for (let x = 0; x < sz; x++) {
      for (let z = 0; z < sz; z++) {
        const h = 3 + H(x, z, 3, 0.25);
        // Biome by distance from center
        const cx = sz / 2, cz = sz / 2;
        const dist = Math.sqrt((x-cx)**2 + (z-cz)**2) / (sz / 2);
        const top = dist > 0.75 ? 'snow' : dist > 0.5 ? 'stone' : noise(x,z) > 0.85 ? 'sand' : 'grass';

        add(x, h, z, top);
        for (let y = h - 1; y >= h - 2; y--) add(x, y, z, 'dirt');
        for (let y = h - 3; y >= 0; y--) add(x, y, z, 'stone');
      }
    }

  } else {
    // ── ADVENTURE WORLD — mountains, villages, creatures ────
    const hillH = (x, z) => 2 + H(x, z, 7, 0.22) + H(x, z, 3, 0.55);

    // Terrain
    for (let x = 0; x < sz; x++) {
      for (let z = 0; z < sz; z++) {
        const h = hillH(x, z);
        const top = h > 11 ? 'snow' : h > 8 ? 'stone' : noise(x,z) > 0.9 ? 'sand' : 'grass';
        add(x, h, z, top);
        add(x, h-1, z, 'dirt');
        for (let y = h - 2; y >= 0; y--) add(x, y, z, 'stone');
        // Water in low areas
        if (h < 3) {
          for (let wy = h + 1; wy <= 3; wy++) add(x, wy, z, 'water');
        }
      }
    }

    // Villages: scatter 3–5 simple houses
    const numHouses = 3 + Math.floor(noise(sz, 0) * 3);
    const placed = [];
    for (let hi = 0; hi < numHouses * 8; hi++) {
      const hx = 4 + Math.floor(noise(hi, 1) * (sz - 8));
      const hz = 4 + Math.floor(noise(hi, 2) * (sz - 8));
      const hy = hillH(hx, hz);
      if (hy < 4 || hy > 10) continue;
      if (placed.some(p => Math.abs(p[0]-hx) < 8 && Math.abs(p[1]-hz) < 8)) continue;
      placed.push([hx, hz]);
      // House: 5×4×5 with wooden walls, glass windows, leaves roof
      for (let bx = 0; bx < 5; bx++) {
        for (let bz = 0; bz < 5; bz++) {
          for (let by = 1; by <= 4; by++) {
            const wx = hx + bx, wy = hy + by, wz = hz + bz;
            const isWall  = bx===0||bx===4||bz===0||bz===4;
            const isRoof  = by === 4;
            const isWindow = by === 2 && ((bx===2&&(bz===0||bz===4))||(bz===2&&(bx===0||bx===4)));
            if (isRoof)        { add(wx, wy, wz, 'leaves'); }
            else if (isWindow) { add(wx, wy, wz, 'glass'); }
            else if (isWall)   { add(wx, wy, wz, 'wood'); }
          }
        }
      }
      if (placed.length >= numHouses) break;
    }

    // Creatures: encode as special block type marker (client spawns sprite on load)
    // We encode creature spawn points as special "creature_<type>" entries
    const creatureTypes = ['pig', 'horse', 'mermaid', 'dolphin', 'dragon', 'phoenix'];
    for (let ci = 0; ci < 8; ci++) {
      const cx = 2 + Math.floor(noise(ci, 10) * (sz - 4));
      const cz = 2 + Math.floor(noise(ci, 11) * (sz - 4));
      const cy = hillH(cx, cz) + 1;
      const ctype = creatureTypes[ci % creatureTypes.length];
      // Store as metadata, not a block
      blocks.push({ x: cx, y: cy, z: cz, id: `creature:${ctype}` });
    }
  }

  return blocks;
}

// ── GET /api/worlds — list user's worlds ───────────────────
router.get('/', requireAuth, (req, res) => {
  const worlds = [];
  if (!fs.existsSync(WORLDS_DIR)) return res.json([]);
  fs.readdirSync(WORLDS_DIR).forEach(f => {
    if (!f.endsWith('.json')) return;
    try {
      const w = JSON.parse(fs.readFileSync(path.join(WORLDS_DIR, f), 'utf8'));
      if (w.ownerId === req.user.userId) {
        worlds.push({
          id:          w.id,
          name:        w.name,
          type:        w.type,
          size:        w.size,
          inviteCode:  w.inviteCode,
          createdAt:   w.createdAt,
          updatedAt:   w.updatedAt,
          blockCount:  w.blocks?.length ?? 0,
        });
      }
    } catch { /* skip corrupt file */ }
  });
  worlds.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json(worlds);
});

// ── POST /api/worlds — create new world ────────────────────
router.post('/', requireAuth, (req, res) => {
  const { name, type = 'cyclades' } = req.body || {};
  if (!name) return res.status(400).json({ error: 'שם העולם נדרש' });

  const validTypes = ['cyclades', 'adventure', 'flat', 'block'];
  const wtype = validTypes.includes(type) ? type : 'cyclades';

  // Cyclades worlds have a fixed 128×128 size; legacy types keep their
  // request-provided sizes for backwards compatibility with old saves.
  let sz;
  if (wtype === 'cyclades') {
    sz = 128;
  } else {
    const validSizes = [26, 64, 100];
    sz = validSizes.includes(Number(req.body?.size)) ? Number(req.body.size) : 26;
  }

  console.log(`Generating ${wtype} world "${name}" (${sz}×${sz})…`);
  const blocks = generateTerrain(wtype, sz);
  console.log(`  → ${blocks.length} blocks generated`);

  const w = {
    id:         crypto.randomUUID(),
    ownerId:    req.user.userId,
    ownerName:  req.user.username,
    name,
    type:       wtype,
    size:       sz,
    blocks,
    inviteCode: randomCode(6),
    createdAt:  new Date().toISOString(),
    updatedAt:  new Date().toISOString(),
  };
  saveWorld(w);
  res.json(w);
});

// ── GET /api/worlds/invite/:code — resolve invite (public) ─
router.get('/invite/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  const files = fs.readdirSync(WORLDS_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) {
    try {
      const w = JSON.parse(fs.readFileSync(path.join(WORLDS_DIR, f), 'utf8'));
      if (w.inviteCode === code) {
        return res.json({ worldId: w.id, worldName: w.name, ownerName: w.ownerName });
      }
    } catch { /* skip */ }
  }
  res.status(404).json({ error: 'קוד הזמנה לא תקין' });
});

// ── GET /api/worlds/:id — load world ───────────────────────
router.get('/:id', requireAuth, (req, res) => {
  const w = loadWorld(req.params.id);
  if (!w) return res.status(404).json({ error: 'עולם לא נמצא' });

  // Allow owner OR someone with valid invite code (via query param)
  const inviteParam = (req.query.invite || '').toUpperCase();
  const isOwner     = w.ownerId === req.user.userId;
  const hasInvite   = inviteParam && inviteParam === w.inviteCode;
  if (!isOwner && !hasInvite) {
    return res.status(403).json({ error: 'אין גישה לעולם זה' });
  }

  res.json(w);
});

// ── PUT /api/worlds/:id/save — save blocks ─────────────────
router.put('/:id/save', requireAuth, (req, res) => {
  const w = loadWorld(req.params.id);
  if (!w) return res.status(404).json({ error: 'עולם לא נמצא' });
  if (w.ownerId !== req.user.userId) return res.status(403).json({ error: 'רק הבעלים יכול לשמור' });

  const { blocks } = req.body || {};
  if (!Array.isArray(blocks)) return res.status(400).json({ error: 'blocks חסרים' });

  w.blocks = blocks;
  saveWorld(w);
  res.json({ ok: true, updatedAt: w.updatedAt });
});

// ── DELETE /api/worlds/:id ─────────────────────────────────
router.delete('/:id', requireAuth, (req, res) => {
  const w = loadWorld(req.params.id);
  if (!w) return res.status(404).json({ error: 'עולם לא נמצא' });
  if (w.ownerId !== req.user.userId) return res.status(403).json({ error: 'רק הבעלים יכול למחוק' });
  fs.unlinkSync(worldFile(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
module.exports.loadWorld = loadWorld;
