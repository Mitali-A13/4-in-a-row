// backend/src/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const GameManager = require('./game/GameManager');
const { initDB, saveGame, getLeaderboard } = require('./database/db');
const { sendGameEvent } = require('./kafka/producer');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const gameManager = new GameManager(io);

// Initialize DB
initDB();

//REST APIs

app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaderboard = await getLeaderboard();
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeGames: gameManager.games.size });
});


//SOCKET.IO

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_game', ({ username }) => {
    if (!username || !username.trim()) {
      socket.emit('error', { message: 'Username is required' });
      return;
    }

    const game = gameManager.findOrCreateGame(socket, username.trim());

    socket.emit('game_joined', {
      gameId: game.id,
      player: game.getPlayerNumber(socket.id),
      username: username.trim()
    });

    sendGameEvent({
      type: 'PLAYER_JOINED',
      gameId: game.id,
      username: username.trim(),
      timestamp: Date.now()
    });
  });

  socket.on('make_move', ({ gameId, column }) => {
    const game = gameManager.games.get(gameId);
    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    // 🔑 IMPORTANT: do NOT read return value
    game.makeMove(socket.id, column);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    gameManager.handleDisconnect(socket.id);
  });
});

//SERVER START

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
