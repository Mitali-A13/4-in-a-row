const Bot = require('./Bot');
const { v4: uuidv4 } = require('uuid');
const { sendGameEvent } = require('../kafka/producer');
const { saveGame } = require('../database/db');

class Game {
  constructor(id, io) {
    this.hasEnded = false;
    this.id = id;
    this.io = io;
    this.board = Array(6).fill(null).map(() => Array(7).fill(0));
    this.players = {};
    this.currentTurn = 1;
    this.status = 'waiting';
    this.startTime = Date.now();
    this.winner = null;
    this.bot = null;
    this.matchmakingTimeout = null;
    this.disconnectTimers = {};
  }

  addPlayer(socket, username) {
    const playerNumber = Object.keys(this.players).length === 0 ? 1 : 2;

    this.players[playerNumber] = {
      socketId: socket.id,
      username,
      connected: true
    };

    socket.join(this.id);

    if (playerNumber === 1) {
      this.matchmakingTimeout = setTimeout(() => {
        if (Object.keys(this.players).length === 1) {
          this.startGameWithBot();
        }
      }, 10000);
    } else {
      if (this.matchmakingTimeout) clearTimeout(this.matchmakingTimeout);
      this.startGame();
    }

    return playerNumber;
  }

  startGameWithBot() {
    this.bot = new Bot(2, this);
    this.players[2] = {
      socketId: 'bot',
      username: 'Bot',
      connected: true
    };

    this.startGame();
  }

  startGame() {
    this.status = 'playing';
    this.startTime = Date.now();

    this.io.to(this.id).emit('game_started', {
      player1: this.players[1].username,
      player2: this.players[2].username,
      currentTurn: this.currentTurn,
      board: this.board
    });

    sendGameEvent({
      type: 'GAME_STARTED',
      gameId: this.id,
      players: {
        player1: this.players[1].username,
        player2: this.players[2].username
      },
      timestamp: Date.now()
    });
  }

  makeMove(socketId, column) {
    if (this.status !== 'playing') return null;

    const playerNumber = this.getPlayerNumber(socketId);
    if (!playerNumber || playerNumber !== this.currentTurn) return null;

    let row = -1;
    for (let r = 5; r >= 0; r--) {
      if (this.board[r][column] === 0) {
        row = r;
        break;
      }
    }

    if (row === -1) return null;

    this.board[row][column] = playerNumber;

    const winningCells = this.checkWinner(row, column, playerNumber);

    if (winningCells) {
      this.endGame(playerNumber, false);

      this.io.to(this.id).emit('game_over', {
        winner: playerNumber,
        winningCells,
        board: this.board
      });
      
      return {
        column,
        row,
        player: playerNumber,
        winner: playerNumber,
        winningCells,
        draw: false
      };
    }

    if (this.isBoardFull()) {
      this.endGame(null, true);

      this.io.to(this.id).emit('game_over', {
        draw: true,
        board: this.board
      });
      
      return {
        column,
        row,
        player: playerNumber,
        winner: null,
        draw: true
      };
    }

    this.currentTurn = this.currentTurn === 1 ? 2 : 1;

    this.io.to(this.id).emit('move_made', {
      column,
      row,
      player: playerNumber,
      board: this.board,
      currentTurn: this.currentTurn
    });

    // only trigger bot move if this is not already a bot move
    if (socketId !== 'bot') {
      this.triggerBotMove();
    }
    
    return {
      column,
      row,
      player: playerNumber,
      winner: null,
      draw: false
    };
  }

  triggerBotMove() {
    if (this.bot && this.currentTurn === 2 && this.status === 'playing') {
      setTimeout(() => {
        const result = this.bot.makeMove();
        if (!result) return;

        // don't emit or handle game 
        if (!result.winner && !result.draw) {
          this.io.to(this.id).emit('move_made', {
            column: result.column,
            row: result.row,
            player: result.player,
            board: this.board,
            currentTurn: this.currentTurn
          });
        }
      }, 800);
    }
  }

  // async endGame(winner, isDraw) {
  //   this.status = 'finished';
  //   this.winner = winner;

  //   sendGameEvent({
  //     type: 'GAME_ENDED',
  //     gameId: this.id,
  //     winner,
  //     draw: isDraw,
  //     duration: Date.now() - this.startTime,
  //     timestamp: Date.now()
  //   });

  //   // saving game to db for leaderboard
  //   try {
  //     // ensuring players exist before accessing them
  //     if (!this.players[1] || !this.players[2]) {
  //       console.error('Players not found:', this.players);
  //       return;
  //     }

  //     const gameData = {
  //       gameId: this.id,
  //       player1: this.players[1].username,
  //       player2: this.players[2].username,
  //       winner: winner && this.players[winner] ? this.players[winner].username : null,
  //       isDraw,
  //       duration: Date.now() - this.startTime,
  //       timestamp: Date.now()
  //     };

  //     console.log('Saving game data:', gameData);
  //     await saveGame(gameData);
  //     console.log('Game saved to database successfully');
  //   } catch (error) {
  //     console.error('Failed to save game:', error);
  //   }

  //   if (this.matchmakingTimeout) clearTimeout(this.matchmakingTimeout);
  //   Object.values(this.disconnectTimers).forEach(clearTimeout);
  // }

 async endGame(winner, isDraw) {

  //prevent duplicate execution
  if (this.hasEnded) {
    console.log('endGame already executed, skipping...');
    return;
  }
  this.hasEnded = true;

  this.status = 'finished';
  this.winner = winner;

  sendGameEvent({
    type: 'GAME_ENDED',
    gameId: this.id,
    winner,
    draw: isDraw,
    duration: Date.now() - this.startTime,
    timestamp: Date.now()
  });

  // saving game to db for leaderboard
  try {
    // ensuring players exist before accessing them
    if (!this.players[1] || !this.players[2]) {
      console.error('Players not found:', this.players);
      return;
    }

    const gameData = {
      gameId: this.id,
      player1: this.players[1].username,
      player2: this.players[2].username,
      winner: winner && this.players[winner]
        ? this.players[winner].username
        : null,
      isDraw,
      duration: Date.now() - this.startTime,
      timestamp: Date.now()
    };

    console.log('Saving game data:', gameData);
    await saveGame(gameData);
    console.log('Game saved to database successfully');

  } catch (error) {
    console.error('Failed to save game:', error);
  }

  if (this.matchmakingTimeout) clearTimeout(this.matchmakingTimeout);
  Object.values(this.disconnectTimers).forEach(clearTimeout);
}



  handleDisconnect(socketId) {
    const playerNumber = this.getPlayerNumber(socketId);
    if (!playerNumber || this.status === 'finished') return;

    this.players[playerNumber].connected = false;

    this.disconnectTimers[playerNumber] = setTimeout(() => {
      const winner = playerNumber === 1 ? 2 : 1;
      this.endGame(winner, false);

      this.io.to(this.id).emit('game_over', {
        winner,
        reason: 'opponent_disconnected',
        board: this.board
      });
    }, 30000);
  }

  getPlayerNumber(socketId) {
    for (const [num, player] of Object.entries(this.players)) {
      if (player.socketId === socketId) return Number(num);
    }
    return null;
  }

  checkWinner(row, col, player) {
    const directions = [
      [[0, 1], [0, -1]],
      [[1, 0], [-1, 0]],
      [[1, 1], [-1, -1]],
      [[1, -1], [-1, 1]]
    ];

    for (const [d1, d2] of directions) {
      const cells = [[row, col]];

      for (let i = 1; i < 4; i++) {
        const r = row + d1[0] * i;
        const c = col + d1[1] * i;
        if (this.board[r]?.[c] === player) cells.push([r, c]);
        else break;
      }

      for (let i = 1; i < 4; i++) {
        const r = row + d2[0] * i;
        const c = col + d2[1] * i;
        if (this.board[r]?.[c] === player) cells.push([r, c]);
        else break;
      }

      if (cells.length >= 4) return cells;
    }
    return null;
  }

  isBoardFull() {
    return this.board[0].every(cell => cell !== 0);
  }
}

class GameManager {
  constructor(io) {
    this.io = io;
    this.games = new Map();
    this.waitingPlayers = [];
  }

  findOrCreateGame(socket, username) {
    if (this.waitingPlayers.length > 0) {
      const gameId = this.waitingPlayers.shift();
      const game = this.games.get(gameId);
      game.addPlayer(socket, username);
      return game;
    }

    const gameId = uuidv4();
    const game = new Game(gameId, this.io);
    this.games.set(gameId, game);
    this.waitingPlayers.push(gameId);
    game.addPlayer(socket, username);
    return game;
  }

  handleDisconnect(socketId) {
    for (const game of this.games.values()) {
      game.handleDisconnect(socketId);
    }
  }
}

module.exports = GameManager;