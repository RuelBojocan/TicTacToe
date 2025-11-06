// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// serve static files
app.use(express.static("public"));

// rooms data structure
// rooms[roomId] = { players: {socketId: mark}, board: Array(9), turn: "X", finished: false }
const rooms = {};

function checkWin(board) {
  const wins = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const [a,b,c] of wins) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  if (board.every(cell => cell)) return "draw";
  return null;
}

io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  socket.on("createRoom", (cb) => {
    const roomId = Math.random().toString(36).slice(2, 8).toUpperCase();
    rooms[roomId] = {
      players: {},
      board: Array(9).fill(null),
      turn: "X",
      finished: false
    };
    socket.join(roomId);
    rooms[roomId].players[socket.id] = "X";
    console.log(`room ${roomId} created by ${socket.id}`);
    
    // ✅ Send back the roomId so frontend can show it
    cb({ ok: true, roomId, mark: "X" });
    
    io.to(roomId).emit("roomUpdate", { playersCount: Object.keys(rooms[roomId].players).length });
  });

  socket.on("joinRoom", (roomId, cb) => {
    roomId = (roomId || "").toUpperCase();
    const room = rooms[roomId];
    if (!room) return cb({ ok: false, error: "Room not found." });
    if (Object.keys(room.players).length >= 2) return cb({ ok: false, error: "Room full." });

    socket.join(roomId);
    room.players[socket.id] = "O";
    console.log(`${socket.id} joined room ${roomId} as O`);
    cb({ ok: true, roomId, mark: "O" });

    const sockets = Object.keys(room.players);
    if (sockets.length === 2) {
      io.to(roomId).emit("startGame", {
        board: room.board,
        turn: room.turn,
        players: Object.values(room.players)
      });
      io.to(roomId).emit("roomUpdate", { playersCount: 2 });
    } else {
      io.to(roomId).emit("roomUpdate", { playersCount: sockets.length });
    }
  });

  socket.on("makeMove", ({ roomId, index }, cb) => {
    roomId = (roomId || "").toUpperCase();
    const room = rooms[roomId];
    if (!room) return cb && cb({ ok: false, error: "Room not found." });
    if (room.finished) return cb && cb({ ok: false, error: "Game finished." });
    const playerMark = room.players[socket.id];
    if (!playerMark) return cb && cb({ ok: false, error: "You are not in this room." });
    if (room.turn !== playerMark) return cb && cb({ ok: false, error: "Not your turn." });
    if (typeof index !== "number" || index < 0 || index > 8) return cb && cb({ ok: false, error: "Invalid move." });
    if (room.board[index]) return cb && cb({ ok: false, error: "Cell already occupied." });

    room.board[index] = playerMark;
    const result = checkWin(room.board);
    if (result === "X" || result === "O") {
      room.finished = true;
      io.to(roomId).emit("update", { board: room.board, turn: room.turn });
      io.to(roomId).emit("gameOver", { winner: result });
    } else if (result === "draw") {
      room.finished = true;
      io.to(roomId).emit("update", { board: room.board, turn: room.turn });
      io.to(roomId).emit("gameOver", { winner: "draw" });
    } else {
      room.turn = (room.turn === "X") ? "O" : "X";
      io.to(roomId).emit("update", { board: room.board, turn: room.turn });
    }
    if (cb) cb({ ok: true });
  });

  socket.on("resetGame", (roomId, cb) => {
    roomId = (roomId || "").toUpperCase();
    const room = rooms[roomId];
    if (!room) return cb && cb({ ok: false, error: "Room not found." });
    room.board = Array(9).fill(null);
    room.turn = "X";
    room.finished = false;
    io.to(roomId).emit("update", { board: room.board, turn: room.turn });
    io.to(roomId).emit("reset");
    if (cb) cb({ ok: true });
  });

  socket.on("leaveRoom", (roomId) => {
    roomId = (roomId || "").toUpperCase();
    const room = rooms[roomId];
    if (!room) return;
    delete room.players[socket.id];
    socket.leave(roomId);
    io.to(roomId).emit("roomUpdate", { playersCount: Object.keys(room.players).length });
    io.to(roomId).emit("opponentLeft");
    if (Object.keys(room.players).length === 0) {
      delete rooms[roomId];
      console.log(`room ${roomId} deleted`);
    }
  });

  socket.on("disconnecting", () => {
    const joinedRooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    for (const roomId of joinedRooms) {
      const room = rooms[roomId];
      if (!room) continue;
      delete room.players[socket.id];
      io.to(roomId).emit("roomUpdate", { playersCount: Object.keys(room.players).length });
      io.to(roomId).emit("opponentLeft");
      if (Object.keys(room.players).length === 0) {
        delete rooms[roomId];
        console.log(`room ${roomId} deleted`);
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("socket disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
