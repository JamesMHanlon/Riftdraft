// Rift Draft server: serves the game from ./public and relays online-duel messages over WebSockets.
// The host player's browser runs the game rules; this server only pairs players in rooms and forwards messages.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".json": "application/json" };

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch (e) { res.writeHead(400); return res.end(); }
  if (p === "/") p = "/index.html";
  const file = path.join(PUBLIC, path.normalize(p));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 1 << 20 });
const rooms = new Map();
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
let nextId = 1;
const newCode = () => { let c; do { c = Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join(""); } while (rooms.has(c)); return c; };
const send = (ws, m) => ws.readyState === 1 && ws.send(JSON.stringify(m));

wss.on("connection", ws => {
  ws.alive = true;
  ws.on("pong", () => (ws.alive = true));
  ws.on("message", raw => {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.type === "create" && !ws.room) {
      const code = newCode();
      ws.room = { code, host: ws, peers: new Map() };
      ws.pid = "host";
      rooms.set(code, ws.room);
      send(ws, { type: "created", code });
    } else if (m.type === "join" && !ws.room) {
      const room = rooms.get(String(m.code || "").toUpperCase());
      if (!room) return send(ws, { type: "error", message: "Room not found. Check the code." });
      if (room.peers.size >= 4) return send(ws, { type: "error", message: "That room is full." });
      ws.pid = "p" + nextId++;
      ws.room = room;
      room.peers.set(ws.pid, ws);
      send(ws, { type: "joined", id: ws.pid, code: room.code });
      send(room.host, { type: "peer-join", id: ws.pid });
    } else if (m.type === "send" && ws.room) {
      const room = ws.room, out = { type: "msg", from: ws.pid, data: m.data };
      if (ws.pid !== "host") send(room.host, out);
      else if (m.to === "*") room.peers.forEach(p => send(p, out));
      else { const p = room.peers.get(m.to); if (p) send(p, out); }
    }
  });
  ws.on("close", () => {
    const room = ws.room;
    if (!room) return;
    if (ws.pid === "host") {
      room.peers.forEach(p => { send(p, { type: "host-left" }); p.close(); });
      rooms.delete(room.code);
    } else {
      room.peers.delete(ws.pid);
      send(room.host, { type: "peer-leave", id: ws.pid });
    }
  });
});

// Ping clients so idle connections aren't dropped by proxies, and clean up dead ones.
setInterval(() => wss.clients.forEach(ws => { if (!ws.alive) return ws.terminate(); ws.alive = false; ws.ping(); }), 30000);

server.listen(PORT, () => console.log(`Rift Draft running at http://localhost:${PORT}`));
