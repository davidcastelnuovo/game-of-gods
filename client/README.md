# לקוח משחקי האלים (Vite — שלב A)

פיצול הדרגתי של `minecraft-chaluton.html` למודולי ES. **המשחק בפרודקשן עדיין נטען מהקובץ המונוליתי** דרך השרת.

## מבנה תיקיות

| תיקייה | תפקיד (מתוכנן) |
|--------|----------------|
| `src/render/` | renderer, תאורה, שמיים |
| `src/world/` | בלוקים, InstancedMesh, עולם |
| `src/net/` | REST, WebSocket |
| `src/ui/` | HUD, ספרייה, תפריטים |
| `src/game/` | מצב משחק, יצורים, אלים |
| `src/assets/` | ייבוא glTF/טקסטורות (עתידי) |

**בפר בזה (slice 1–2):** `world/block-definitions.js`, `world/world-constants.js`, `world/world-keys.js`, `net/api.js`, `net/ws-protocol.js`, `net/ws-client.js`, `net/player-colors.js`, `render/bootstrap.js`.

## פיתוח

```bash
# טרמינל 1 — שרת (משחק מלא + API + WS)
cd server && npm install && node server.js

# טרמינל 2 — Vite (scaffold בלבד, פורט 5173)
cd client && npm install && npm run dev
```

ב-Vite, בקשות ל-`/api/*` ו-`/ws` מנותבות ל-`localhost:3000` (ראה `vite.config.js`).

## בנייה

```bash
cd client && npm run build
```

הפלט ב-`client/dist/`. עדיין **לא** מוגש אוטומטית ב-`/` — השרת ממשיך להגיש `minecraft-chaluton.html`.

## בדיקה ידנית (smoke)

1. `cd server && node server.js` → פתח `http://localhost:3000/` — המשחק נטען, מולטיפלייר עובד.
2. `cd client && npm run dev` → `http://localhost:5173/` — דף scaffold מציג ספירת מודולים.
