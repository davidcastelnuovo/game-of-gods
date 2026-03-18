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

function generateTerrain(type, sz) {
  const blocks = [];
  const add = (x, y, z, id) => blocks.push({ x, y, z, id });

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
  const { name, type = 'block', size = 26 } = req.body || {};
  if (!name) return res.status(400).json({ error: 'שם העולם נדרש' });

  const validSizes = [26, 64, 100];
  const sz = validSizes.includes(Number(size)) ? Number(size) : 26;
  const validTypes = ['adventure', 'flat', 'block'];
  const wtype = validTypes.includes(type) ? type : 'block';

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
