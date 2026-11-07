# משחקי האלים (Game of GODS)

משחק ווקסלים בדפדפן (Three.js) עם שרת Express, שמירת עולמות ומולטיפלייר WebSocket.

## הרצה מהירה (פרודקשן / משחק מלא)

```bash
cd server
npm install
node server.js
```

פתח **http://localhost:3000/** — מוגש `minecraft-chaluton.html` (כולל `?invite=` לקישורי הצטרפות).

## פיתוח לקוח מודולרי (Vite)

המשחק המלא עדיין רץ מהמונולית; תיקיית `client/` היא תחילת שלב A (מודולים).

```bash
# טרמינל 1
cd server && node server.js

# טרמינל 2
cd client && npm install && npm run dev
```

- משחק: **http://localhost:3000/**
- Scaffold Vite: **http://localhost:5173/** (פרוקסי ל-API ו-WS)

פרטים: [client/README.md](./client/README.md).

## מסמכים

- [docs/assets-pipeline.md](./docs/assets-pipeline.md) — זרימת נכסים תלת־ממד (עברית)
