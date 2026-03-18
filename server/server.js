const express = require('express');
const http    = require('http');
const path    = require('path');

const authRouter       = require('./auth');
const worldsRouter     = require('./worlds');
const { handleUpgrade } = require('./multiplayer');

const app = express();

// ── Force no-cache on EVERY response ──────────────────────────────────────────
// This must come first so it applies to static files AND the fallback sendFile.
app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Parse JSON bodies up to 10 MB (large world saves)
app.use(express.json({ limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, '..')));

// API routes
app.use('/api/auth',   authRouter);
app.use('/api/worlds', worldsRouter);

// Fallback: serve the game for any unknown route (supports ?invite= deep-links)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'minecraft-chaluton.html'));
});

const server = http.createServer(app);

// Hand WebSocket upgrade requests to the multiplayer module
server.on('upgrade', handleUpgrade);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎮 Minecraft Chaluton server running at http://localhost:${PORT}\n`);
});
