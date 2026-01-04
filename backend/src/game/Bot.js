class Bot {
  constructor(playerNumber, game) {
    this.playerNumber = playerNumber;
    this.game = game;
    this.opponent = playerNumber === 1 ? 2 : 1;
    console.log('Bot created as player', playerNumber);
  }

  makeMove() {
    console.log('Bot is thinking...');
    const column = this.findBestMove();
    console.log('Bot chose column:', column);

    // Call makeMove and get the result
    const result = this.game.makeMove('bot', column);
    
    if (!result) return null;

    return {
      column: result.column,
      row: result.row,
      player: this.playerNumber,
      winner: result.winner,
      winningCells: result.winningCells,
      draw: result.draw
    };
  }

  findBestMove() {
    // can bot win
    for (let col = 0; col < 7; col++) {
      if (this.canWin(col, this.playerNumber)) {
        return col;
      }
    }

    //block opponent
    for (let col = 0; col < 7; col++) {
      if (this.canWin(col, this.opponent)) {
        return col;
      }
    }

    //strategic positions
    const strategicMoves = this.findStrategicMoves();
    if (strategicMoves.length > 0) {
      return strategicMoves[0];
    }

    //center column
    if (this.isColumnAvailable(3)) {
      return 3;
    }

    // any valid column
    for (let col = 0; col < 7; col++) {
      if (this.isColumnAvailable(col)) {
        return col;
      }
    }

    return 3; // fallback
  }

  canWin(column, player) {
    if (!this.isColumnAvailable(column)) return false;

    const row = this.getNextRow(column);
    if (row === -1) return false;

    // simulation
    this.game.board[row][column] = player;
    const winning = this.game.checkWinner(row, column, player) !== null;
    this.game.board[row][column] = 0;

    return winning;
  }

  findStrategicMoves() {
    const moves = [];

    for (let col = 0; col < 7; col++) {
      if (!this.isColumnAvailable(col)) continue;

      const row = this.getNextRow(col);
      if (row === -1) continue;

      this.game.board[row][col] = this.playerNumber;
      const score = this.evaluatePosition(row, col);
      this.game.board[row][col] = 0;

      moves.push({ column: col, score });
    }

    moves.sort((a, b) => b.score - a.score);
    return moves.map(m => m.column);
  }

  evaluatePosition(row, col) {
    let score = 0;

    const directions = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1]
    ];

    for (const [dr, dc] of directions) {
      score += this.countPotential(row, col, dr, dc);
    }

    return score;
  }

  countPotential(row, col, dr, dc) {
    let count = 1;
    let empty = 0;

    for (let i = 1; i < 4; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r < 0 || r >= 6 || c < 0 || c >= 7) break;

      if (this.game.board[r][c] === this.playerNumber) count++;
      else if (this.game.board[r][c] === 0) {
        empty++;
        break;
      } else break;
    }

    for (let i = 1; i < 4; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r < 0 || r >= 6 || c < 0 || c >= 7) break;

      if (this.game.board[r][c] === this.playerNumber) count++;
      else if (this.game.board[r][c] === 0) {
        empty++;
        break;
      } else break;
    }

    if (count >= 3) return 100;
    if (count === 2 && empty > 0) return 10;
    if (count === 1 && empty > 1) return 1;
    return 0;
  }

  isColumnAvailable(column) {
    return this.game.board[0][column] === 0;
  }

  getNextRow(column) {
    for (let row = 5; row >= 0; row--) {
      if (this.game.board[row][column] === 0) return row;
    }
    return -1;
  }
}

module.exports = Bot;