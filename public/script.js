const socket = io();

const createBtn = document.getElementById("createRoom");
const joinBtn = document.getElementById("joinRoom");
const joinInput = document.getElementById("joinInput");
const roomDisplay = document.getElementById("roomDisplay");
const status = document.getElementById("status");
const boardDiv = document.getElementById("board");
const resetBtn = document.getElementById("resetBtn");

let currentRoom = null;
let myMark = null;
let currentTurn = null;

// --- Create Room ---
createBtn.onclick = () => {
  socket.emit("createRoom", (res) => {
    if (res.ok) {
      currentRoom = res.roomId;
      myMark = res.mark;
      roomDisplay.textContent = `Your Room ID: ${res.roomId}`;
      status.textContent = "Waiting for another player to join...";
    }
  });
};

// --- Join Room ---
joinBtn.onclick = () => {
  const roomId = joinInput.value.trim().toUpperCase();
  if (!roomId) return alert("Enter a room code!");
  socket.emit("joinRoom", roomId, (res) => {
    if (res.ok) {
      currentRoom = res.roomId;
      myMark = res.mark;
      roomDisplay.textContent = `Joined Room: ${roomId}`;
      status.textContent = "Joined successfully! Waiting for opponent...";
    } else {
      alert(res.error);
    }
  });
};

// --- Start Game ---
socket.on("startGame", ({ board, turn }) => {
  currentTurn = turn;
  resetBtn.style.display = "inline-block";
  status.textContent = `Game started! You are ${myMark}. Turn: ${turn}`;
  drawBoard(board);
});

// --- Update board ---
socket.on("update", ({ board, turn }) => {
  currentTurn = turn;
  drawBoard(board);
  status.textContent = `Turn: ${turn}`;
});

// --- Game Over ---
socket.on("gameOver", ({ winner }) => {
  if (winner === "draw") {
    status.textContent = "It's a draw!";
  } else {
    status.textContent = `Game Over! ${winner} wins!`;
  }
});

// --- Opponent Left ---
socket.on("opponentLeft", () => {
  status.textContent = "Opponent left the game.";
});

// --- Draw board ---
function drawBoard(board) {
  boardDiv.innerHTML = "";
  board.forEach((cell, i) => {
    const div = document.createElement("div");
    div.classList.add("cell");
    div.textContent = cell || "";
    div.onclick = () => {
      if (!cell && myMark === currentTurn) {
        socket.emit("makeMove", { roomId: currentRoom, index: i });
      }
    };
    boardDiv.appendChild(div);
  });
}

// --- Reset game ---
resetBtn.onclick = () => {
  if (currentRoom) {
    socket.emit("resetGame", currentRoom);
  }
};
