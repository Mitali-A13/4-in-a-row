// app.js

const BACKEND_URL = (() => {
    
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000';
    }
    
    // Production 
    return '';
})();

// Game state
let socket = null;
let gameId = null;
let playerNumber = null;
let username = null;
let currentBoard = [];
let waitTimer = null;
let waitSeconds = 0;

// DOM Elements
const screens = {
    login: document.getElementById('loginScreen'),
    waiting: document.getElementById('waitingScreen'),
    game: document.getElementById('gameScreen'),
    gameOver: document.getElementById('gameOverScreen'),
    leaderboard: document.getElementById('leaderboardScreen')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    showScreen('login');
    console.log('Connecting to backend:', BACKEND_URL);
});

function setupEventListeners() {
    document.getElementById('joinBtn').addEventListener('click', joinGame);
    document.getElementById('usernameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinGame();
    });
    document.getElementById('playAgainBtn').addEventListener('click', () => {
        resetGame();
        showScreen('login');
    });
    document.getElementById('viewLeaderboardBtn').addEventListener('click', showLeaderboard);
    document.getElementById('backToGameBtn').addEventListener('click', () => {
        showScreen('login');
    });
}

function joinGame() {
    const usernameInput = document.getElementById('usernameInput');
    username = usernameInput.value.trim();
    
    if (!username) {
        alert('Please enter a username!');
        return;
    }

    // Connect to socket
    socket = io(BACKEND_URL);
    
    socket.on('connect', () => {
        console.log('Connected to server');
        socket.emit('join_game', { username });
        showScreen('waiting');
        startWaitTimer();
    });

    socket.on('connect_error', (error) => {
        console.error('Connection failed:', error);
        alert('Cannot connect to server. Please check if backend is running.');
    });

    socket.on('game_joined', (data) => {
        gameId = data.gameId;
        playerNumber = data.player;
        console.log('Joined game:', data);
    });

    socket.on('game_started', (data) => {
        stopWaitTimer();
        console.log('Game started:', data);
        
        // Set player names 
        const player1El = document.getElementById('player1Name');
        const player2El = document.getElementById('player2Name');
        
        player1El.textContent = data.player1;
        player2El.textContent = data.player2;
        
        
        if (data.player2 === 'Bot' || data.player2.includes('Bot')) {
            player2El.textContent = 'Bot';
        }
        
        currentBoard = data.board;
        createBoard();
        updateTurnIndicator(data.currentTurn);
        showScreen('game');
    });

    socket.on('move_made', (data) => {
        console.log('Move made:', data);
        console.log('Current turn:', data.currentTurn, 'My player:', playerNumber);
        currentBoard = data.board;
        updateBoard(data.board, null, { row: data.row, col: data.column });
        updateTurnIndicator(data.currentTurn);
    });

    socket.on('game_over', (data) => {
        console.log('Game over:', data);
        currentBoard = data.board;
        updateBoard(data.board, data.winningCells, null);
        
        setTimeout(() => {
            if (data.winner) {
                const winnerName = data.winner === playerNumber ? 'You' : 
                    (data.winner === 1 ? document.getElementById('player1Name').textContent : 
                    document.getElementById('player2Name').textContent);
                document.getElementById('gameOverTitle').textContent = 
                    data.winner === playerNumber ? 'You Won!' : 'You Lost!';
                document.getElementById('gameOverMessage').textContent = 
                    data.winner === playerNumber ? 
                    `✨ Amazing! You connected 4 discs! ✨` :
                    `${winnerName} connected 4 discs! Better luck next time!`;
            } else if (data.draw) {
                document.getElementById('gameOverTitle').textContent = "It's a Draw!";
                document.getElementById('gameOverMessage').textContent = 
                    'The board is full! Great match!';
            } else if (data.reason === 'opponent_disconnected') {
                document.getElementById('gameOverTitle').textContent = 'You Won!';
                document.getElementById('gameOverMessage').textContent = 
                    '👋 Opponent left the game';
            }
            showScreen('gameOver');
        }, 2000);
    });

    socket.on('player_disconnected', (data) => {
        showGameStatus(`Player ${data.player} disconnected. Waiting ${data.reconnectTime}s for reconnection...`);
    });

    socket.on('player_reconnected', (data) => {
        showGameStatus(`Player ${data.player} is back!`);
        setTimeout(() => hideGameStatus(), 2000);
    });

    socket.on('error', (data) => {
        alert(data.message);
    });
}

function createBoard() {
    const gameBoard = document.getElementById('gameBoard');
    gameBoard.innerHTML = '';
    
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 7; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            cell.addEventListener('click', () => makeMove(col));
            
            gameBoard.appendChild(cell);
        }
    }
}

function updateBoard(board, winningCells = null, lastMove = null) {
    const cells = document.querySelectorAll('.cell');
    
    cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const value = board[row][col];
        
        const isNewDisc = lastMove && lastMove.row === row && lastMove.col === col;
        const existingDisc = cell.querySelector('.disc');
        const hadDisc = existingDisc !== null;
        
        cell.innerHTML = '';
        cell.classList.remove('filled', 'winning');
        
        if (value !== 0) {
            const disc = document.createElement('div');
            disc.className = `disc player${value}`;
            
            if (isNewDisc && !hadDisc) {
                disc.style.animation = 'dropIn 0.5s ease-out';
            } else if (hadDisc) {
                disc.style.animation = 'none';
            }
            
            cell.appendChild(disc);
            cell.classList.add('filled');
        }
    });

    if (winningCells) {
        winningCells.forEach(([row, col]) => {
            const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
            if (cell) {
                cell.classList.add('winning');
            }
        });
    }
}

function makeMove(column) {
    if (!socket || !gameId) {
        console.log('No socket or game');
        return;
    }
    
    const indicator = document.getElementById('turnIndicator');
    if (indicator.textContent === "Opponent's Turn") {
        showGameStatus("Wait for your turn!");
        setTimeout(() => hideGameStatus(), 1500);
        return;
    }
    
    console.log('Making move:', column);
    socket.emit('make_move', { gameId, column });
}

function updateTurnIndicator(currentTurn) {
    const indicator = document.getElementById('turnIndicator');
    const player1Info = document.getElementById('player1Info');
    const player2Info = document.getElementById('player2Info');
    
    player1Info.style.opacity = currentTurn === 1 ? '1' : '0.5';
    player2Info.style.opacity = currentTurn === 2 ? '1' : '0.5';
    
    if (currentTurn === playerNumber) {
        indicator.textContent = 'Your Turn';
        indicator.style.background = 'white';
        indicator.style.color = 'black';
    } else {
        indicator.textContent = "Opponent's Turn";
        indicator.style.background = 'white';
        indicator.style.color = 'black';
    }
}

function showGameStatus(message) {
    const status = document.getElementById('gameStatus');
    status.textContent = message;
    status.style.display = 'block';
}

function hideGameStatus() {
    const status = document.getElementById('gameStatus');
    status.style.display = 'none';
}

function startWaitTimer() {
    waitSeconds = 0;
    document.getElementById('waitTimer').textContent = waitSeconds;
    waitTimer = setInterval(() => {
        waitSeconds++;
        document.getElementById('waitTimer').textContent = waitSeconds;
        if (waitSeconds >= 10) {
            document.getElementById('waitingText').textContent = 'Starting game with Bot...';
        } else if (waitSeconds >= 5) {
            document.getElementById('waitingText').textContent = 'Still searching...';
        }
    }, 1000);
}

function stopWaitTimer() {
    if (waitTimer) {
        clearInterval(waitTimer);
        waitTimer = null;
    }
}

async function showLeaderboard() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/leaderboard`);
        const leaderboard = await response.json();
        
        const tbody = document.getElementById('leaderboardBody');
        tbody.innerHTML = '';
        
        leaderboard.forEach((player, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${player.username}</td>
                <td>${player.wins}</td>
                <td>${player.losses}</td>
                <td>${player.draws}</td>
                <td>${player.total_games}</td>
            `;
            tbody.appendChild(row);
        });
        
        showScreen('leaderboard');
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        alert('Failed to load leaderboard. Please check your connection.');
    }
}

function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function resetGame() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    gameId = null;
    playerNumber = null;
    currentBoard = [];
    document.getElementById('usernameInput').value = '';
    stopWaitTimer();
}