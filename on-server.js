const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");

const TOGGLE_FILE = path.join(__dirname, "is-on");
const wss = new WebSocket.Server({ port: 1337 });

wss.on("connection", (ws) => {
  ws.on("message", (state) => {
    try {
      if (state === "true") {
        fs.writeFileSync(TOGGLE_FILE, "");
      } else {
        fs.unlinkSync(TOGGLE_FILE);
      }
    } catch (error) {}
  });
});
